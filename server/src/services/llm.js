const { z } = require('zod');

/**
 * Build dynamic Zod validation schema from template fields definition
 * @param {Array<Object>} fields - Template fields
 * @returns {z.ZodObject}
 */
const buildSchema = (fields) => {
  const shape = {};
  for (const f of fields) {
    if (f.type === 'number') {
      shape[f.key] = z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[^0-9.-]/g, '');
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }
        return null;
      }, z.number().nullable().optional());
    } else {
      shape[f.key] = z.preprocess((val) => {
        if (val === null || val === undefined) return null;
        return String(val).trim();
      }, z.string().nullable().optional());
    }
  }
  return z.object(shape);
};

const MONTH_NAMES = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

/**
 * Robust date parser supporting numeric dates, text months, and ISO formats
 */
const parseDateToISO = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim().replace(/,/g, '');

  // 1. Text month: "12 Nov 2026", "12-Nov-2026", "12 November 2026"
  const dayMonthTextMatch = str.match(/\b(\d{1,2})[-/\s]+([A-Za-z]{3,9})[-/\s]+(\d{2,4})\b/);
  if (dayMonthTextMatch) {
    const day = dayMonthTextMatch[1].padStart(2, '0');
    const monthKey = dayMonthTextMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    let year = dayMonthTextMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) return `${year}-${month}-${day}`;
  }

  // 2. Text month prefix: "Nov 12 2026", "November 12 2026"
  const monthTextDayMatch = str.match(/\b([A-Za-z]{3,9})[-/\s]+(\d{1,2})[-/\s]+(\d{2,4})\b/);
  if (monthTextDayMatch) {
    const monthKey = monthTextDayMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const day = monthTextDayMatch[2].padStart(2, '0');
    let year = monthTextDayMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) return `${year}-${month}-${day}`;
  }

  // 3. Numeric: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numMatch = str.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // 4. ISO: YYYY-MM-DD
  const isoMatch = str.match(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
};

/**
 * Sanitize common OCR character confusions in GSTIN
 * e.g., The 14th character in Indian GSTIN is ALWAYS 'Z'. OCR frequently confuses 'Z' with '2'.
 */
const sanitizeGstin = (val) => {
  if (!val || typeof val !== 'string') return val;
  const str = val.trim().toUpperCase();
  if (
    str.length === 15 &&
    str[13] === '2' &&
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}2[A-Z\d]{1}$/.test(str)
  ) {
    return str.slice(0, 13) + 'Z' + str.slice(14);
  }
  return str;
};

/**
 * Convert English number words into numeric amounts (e.g. "Eight Hundred Ninety-nine" -> 899)
 */
const wordsToNumber = (wordsStr) => {
  if (!wordsStr) return null;
  const small = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  const magnitude = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, crore: 10000000, million: 1000000 };

  const tokens = wordsStr.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;

  for (const token of tokens) {
    if (small[token] !== undefined) {
      current += small[token];
    } else if (magnitude[token] !== undefined) {
      if (token === 'hundred') {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        total += (current === 0 ? 1 : current) * magnitude[token];
        current = 0;
      }
    }
  }

  const result = total + current;
  return result > 0 ? result : null;
};

/**
 * Post-process extracted fields with financial domain rules and deterministic Tier-2 recovery
 */
const postProcessExtracted = (extracted, fullText) => {
  const result = { ...extracted };

  // 1. Strict GSTIN validation, filtering, and auto-recovery
  if (result.gstin) {
    const rawGstin = String(result.gstin).replace(/[\s-]/g, '').toUpperCase();
    const sanitized = sanitizeGstin(rawGstin);
    const isValidGstin = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(sanitized);

    if (isValidGstin) {
      result.gstin = sanitized;
    } else {
      console.log(`[GSTIN Filter] Discarded non-GSTIN candidate "${result.gstin}"`);
      result.gstin = null;
    }
  }

  // Tier 2 Backfill: If GSTIN was null or rejected, scan document text for verified GSTIN
  if (!result.gstin) {
    // A. Labeled match (e.g. "GST Registration No:33AAJCC8517E1ZS", "GSTIN: ...")
    const labeledMatch = fullText.match(/(?:GSTIN|GST\s*Reg(?:istration)?(?:\s*No\.?)?|GST\s*No\.?)\s*[:.-]?\s*([0-9A-Z]{15})/i);
    if (labeledMatch) {
      const candidate = sanitizeGstin(labeledMatch[1].toUpperCase());
      if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(candidate)) {
        console.log(`[GSTIN Auto-Recovery] Extracted verified labeled GSTIN: ${candidate}`);
        result.gstin = candidate;
      }
    }

    // B. Standalone 15-character GST format match
    if (!result.gstin) {
      const strictMatch = fullText.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z21][A-Z\d]{1}\b/i);
      if (strictMatch) {
        const candidate = sanitizeGstin(strictMatch[0].toUpperCase());
        if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(candidate)) {
          console.log(`[GSTIN Auto-Recovery] Extracted verified standalone GSTIN: ${candidate}`);
          result.gstin = candidate;
        }
      }
    }
  }

  // 2. Invoice Number Auto-Recovery
  if (!result.invoice_number) {
    const invMatch = fullText.match(/Invoice\s*(?:Number|No\.?|#)\s*[:.-]?\s*([A-Z0-9\/-]{3,30})/i);
    if (invMatch) {
      result.invoice_number = invMatch[1].trim();
    }
  }

  // 3. Cross-verify Total Amount with "Amount in Words" (resolves ₹ symbol read as 3)
  const wordsMatch = fullText.match(/(?:Amount\s*in\s*Words|In\s*words|Rupees\s*in\s*words)\s*[:.-]?\s*([A-Za-z\s-]+?)(?:only|\n|For|$)/i);
  if (wordsMatch) {
    const verifiedWordsAmt = wordsToNumber(wordsMatch[1]);
    if (verifiedWordsAmt) {
      if (
        result.total_amount === null ||
        result.total_amount === undefined ||
        String(result.total_amount).startsWith('3' + verifiedWordsAmt) ||
        Math.abs(result.total_amount - verifiedWordsAmt) > 100
      ) {
        console.log(`[Total Amount Auto-Correction] Correcting ${result.total_amount} to ${verifiedWordsAmt} from Amount in Words: "${wordsMatch[1].trim()}"`);
        result.total_amount = verifiedWordsAmt;
      }
    }
  }

  // Tier 2 Backfill for Total Amount if null
  if (result.total_amount === null || result.total_amount === undefined) {
    const explicitTotal = fullText.match(/(?:(?:grand\s*)?total|amount\s*payable|net\s*payable|balance\s*due)\s*[:.-]?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.\d{2})?)/i);
    if (explicitTotal) {
      const cleaned = parseFloat(explicitTotal[1].replace(/,/g, ''));
      if (!isNaN(cleaned)) result.total_amount = cleaned;
    }
  }

  // 4. Ensure official Invoice Date is preferred over Order Date and normalized to YYYY-MM-DD
  const invoiceDateMatch = fullText.match(/Invoice\s*Date\s*[:.-]?\s*([0-9]{1,2}[-/\s.][A-Za-z]{3,9}[-/\s.][0-9]{2,4}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{2,4})/i);
  if (invoiceDateMatch) {
    const iso = parseDateToISO(invoiceDateMatch[1]);
    if (iso) result.date = iso;
  } else if (result.date) {
    const iso = parseDateToISO(result.date);
    if (iso) result.date = iso;
  }

  return result;
};

/**
 * Fallback heuristic extractor when local Ollama is offline or starting up
 */
const fallbackExtract = (text, fields) => {
  const extracted = {};

  for (const f of fields) {
    const key = f.key.toLowerCase();
    extracted[f.key] = null;

    if (key.includes('gstin')) {
      // 1. Look for explicit GST label (e.g. "GSTIN : ...", "GST Registration No : ...")
      const labeledMatch = text.match(/(?:GSTIN|GST\s*Reg(?:istration)?(?:\s*No\.?)?|GST\s*No\.?)\s*[:.-]?\s*([0-9A-Z]{15})/i);
      if (labeledMatch) {
        const candidate = sanitizeGstin(labeledMatch[1].toUpperCase());
        if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(candidate)) {
          extracted[f.key] = candidate;
        }
      }

      // 2. If no labeled match, look for strict standalone GSTIN pattern
      if (!extracted[f.key]) {
        const strictMatch = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z21][A-Z\d]{1}\b/i);
        if (strictMatch) {
          const candidate = sanitizeGstin(strictMatch[0].toUpperCase());
          if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(candidate)) {
            extracted[f.key] = candidate;
          }
        }
      }
    } else if (key.includes('invoice') || key.includes('number') || key.includes('inv')) {
      // Prioritize explicit "Invoice Number : XYZ" over headers like "Tax Invoice/Bill"
      const priorityMatch = text.match(/Invoice\s*(?:Number|No\.?|#)\s*[:.-]?\s*([A-Z0-9\/-]{3,30})/i);
      if (priorityMatch) {
        extracted[f.key] = priorityMatch[1].trim();
      } else {
        const match = text.match(/(?:inv|bill)\s*(?:no\.?|#)\s*[:.-]?\s*([A-Z0-9\/-]{3,30})/i);
        if (match) extracted[f.key] = match[1].trim();
      }
    } else if (key.includes('total') || key.includes('amount') || key.includes('price')) {
      // 1. Explicit Grand Total / Total / Amount Payable (ignoring Subtotal)
      const explicitTotal = text.match(/(?:(?:grand\s*)?total|amount\s*payable|net\s*payable|balance\s*due)\s*[:.-]?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.\d{2})?)/i);
      if (explicitTotal) {
        const cleaned = parseFloat(explicitTotal[1].replace(/,/g, ''));
        if (!isNaN(cleaned)) extracted[f.key] = cleaned;
      } else {
        const fallbackMatch = text.match(/(?<!sub)(?:total|amount|due)[^0-9\n]*([\d,]+(?:\.\d{2})?)/i);
        if (fallbackMatch) {
          const cleaned = parseFloat(fallbackMatch[1].replace(/,/g, ''));
          if (!isNaN(cleaned)) extracted[f.key] = cleaned;
        }
      }
    } else if (key.includes('date')) {
      // 1. Explicit "Invoice Date : ..."
      const invoiceDateMatch = text.match(/Invoice\s*Date\s*[:.-]?\s*([0-9]{1,2}[-/\s.][A-Za-z]{3,9}[-/\s.][0-9]{2,4}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{2,4})/i);
      if (invoiceDateMatch) {
        const iso = parseDateToISO(invoiceDateMatch[1]);
        if (iso) extracted[f.key] = iso;
      }

      // 2. Generic Date label: "Date : 12 Nov 2026"
      if (!extracted[f.key]) {
        const genericDateMatch = text.match(/\bDate\s*[:.-]?\s*([0-9]{1,2}[-/\s.][A-Za-z]{3,9}[-/\s.][0-9]{2,4}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{2,4})/i);
        if (genericDateMatch) {
          const iso = parseDateToISO(genericDateMatch[1]);
          if (iso) extracted[f.key] = iso;
        }
      }

      // 3. Fallback standalone dates (with text month or numeric)
      if (!extracted[f.key]) {
        const textMonth = text.match(/\b(\d{1,2})[-/\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s]+(\d{2,4})\b/i);
        if (textMonth) {
          const iso = parseDateToISO(textMonth[0]);
          if (iso) extracted[f.key] = iso;
        } else {
          const numDate = text.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/);
          if (numDate) {
            const iso = parseDateToISO(numDate[0]);
            if (iso) extracted[f.key] = iso;
          }
        }
      }
    }
  }

  return postProcessExtracted(extracted, text);
};

/**
 * Call Ollama with JSON mode and temperature 0 to extract template fields
 */
const extractWithLlama = async (fullText, template) => {
  const schema = buildSchema(template.fields);
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3.2';

  const fieldDescriptions = template.fields
    .map((f) => `- ${f.key} (${f.type}): ${f.hint || f.label}`)
    .join('\n');

  const systemPrompt = `You are an expert financial document extractor.
Extract structured data from business documents. Return ONLY a valid JSON object matching the requested schema. Never guess. If a field is not found in the text, use null.
Important rules:
1. In Indian invoices, the currency symbol '₹' is often OCR-misread as '3' or 'R' (e.g. '₹899' misread as '3899'). Cross-check Total Amount with 'Amount in Words' (e.g. 'Eight Hundred Ninety-nine only' = 899).
2. For GSTIN: Look for 'GST Registration No', 'GSTIN', or 'GST No' (15-character Indian format: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char). If the document has no GSTIN, return null.
3. For Date: Use the Invoice Date (not Order Date). Format: YYYY-MM-DD.`;

  const userPrompt = `Document Type: ${template.name}

Extract these fields:
${fieldDescriptions}

Document Text:
"""
${fullText.slice(0, 8000)}
"""`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: 'json',
          options: { temperature: 0 }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const json = await response.json();
      const rawContent = json.message?.content;
      if (!rawContent) throw new Error('Empty response from Ollama');

      const parsed = JSON.parse(rawContent);
      const validated = schema.safeParse(parsed);

      if (validated.success) {
        return postProcessExtracted(validated.data, fullText);
      } else {
        console.warn(`[Llama Extraction Warning] Attempt ${attempt}: Zod validation failed, retrying...`);
      }
    } catch (err) {
      if (attempt === 2) {
        console.warn(`[Llama Offline / Fallback] Ollama error (${err.message}). Using pattern extractor.`);
      }
    }
  }

  return fallbackExtract(fullText, template.fields);
};

module.exports = {
  extractWithLlama,
  buildSchema,
  fallbackExtract,
  sanitizeGstin,
  wordsToNumber,
  postProcessExtracted
};
