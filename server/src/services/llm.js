const { z } = require('zod');

/**
 * Build dynamic Zod validation schema from template fields definition
 * Supports: string, number, date, boolean, list, table (with sub-columns)
 * @param {Array<Object>} fields - Template fields
 * @returns {z.ZodObject}
 */
const buildSchema = (fields = []) => {
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
    } else if (f.type === 'boolean') {
      shape[f.key] = z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
        return Boolean(val);
      }, z.boolean().nullable().optional());
    } else if (f.type === 'list') {
      shape[f.key] = z.preprocess((val) => {
        if (val === null || val === undefined) return [];
        if (Array.isArray(val)) return val.map((v) => String(v).trim());
        if (typeof val === 'string') return val.split('\n').map((s) => s.trim()).filter(Boolean);
        return [];
      }, z.array(z.string()).nullable().optional());
    } else if (f.type === 'table') {
      const colShape = {};
      if (Array.isArray(f.columns)) {
        for (const col of f.columns) {
          if (col.type === 'number') {
            colShape[col.key] = z.preprocess((v) => {
              if (v === null || v === undefined || v === '') return null;
              if (typeof v === 'number') return isNaN(v) ? null : v;
              if (typeof v === 'string') {
                const cleaned = v.replace(/[^0-9.-]/g, '');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
              }
              return null;
            }, z.number().nullable().optional());
          } else {
            colShape[col.key] = z.preprocess((v) => {
              if (v === null || v === undefined) return null;
              return String(v).trim();
            }, z.string().nullable().optional());
          }
        }
      }
      const rowSchema = z.object(colShape).passthrough();
      shape[f.key] = z.preprocess((val) => {
        if (!Array.isArray(val)) return [];
        return val;
      }, z.array(rowSchema).nullable().optional());
    } else {
      shape[f.key] = z.preprocess((val) => {
        if (val === null || val === undefined) return null;
        return String(val).trim();
      }, z.string().nullable().optional());
    }
  }
  return z.object(shape).passthrough();
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
 * Post-process extracted fields with domain normalization and date parsing
 */
const postProcessExtracted = (extracted, fullText, template = {}) => {
  const result = { ...extracted };

  // 1. Generic date normalization for any date fields
  for (const [key, val] of Object.entries(result)) {
    if (key.includes('date') && typeof val === 'string') {
      const iso = parseDateToISO(val);
      if (iso) result[key] = iso;
    }
  }

  // 2. Invoice / Tax specifics (only when relevant fields exist)
  if (result.supplier_gstin) {
    const raw = String(result.supplier_gstin).replace(/[\s-]/g, '').toUpperCase();
    result.supplier_gstin = sanitizeGstin(raw);
  }
  if (result.buyer_gstin) {
    const raw = String(result.buyer_gstin).replace(/[\s-]/g, '').toUpperCase();
    result.buyer_gstin = sanitizeGstin(raw);
  }

  // Total amount cross-verification with "Amount in words" if present
  if (result.total_amount !== undefined && result.total_amount !== null) {
    const wordsMatch = fullText.match(/(?:Amount\s*in\s*Words|In\s*words|Rupees\s*in\s*words)\s*[:.-]?\s*([A-Za-z\s-]+?)(?:only|\n|For|$)/i);
    if (wordsMatch) {
      const verifiedWordsAmt = wordsToNumber(wordsMatch[1]);
      if (verifiedWordsAmt && Math.abs(result.total_amount - verifiedWordsAmt) > 100) {
        result.total_amount = verifiedWordsAmt;
      }
    }
  }

  return result;
};

/**
 * Fallback pattern-based extractor when Ollama is offline or unavailable
 */
const fallbackExtract = (text, fields = []) => {
  const extracted = {};

  for (const f of fields) {
    const key = f.key.toLowerCase();
    extracted[f.key] = null;

    if (f.type === 'list') {
      extracted[f.key] = [];
    } else if (f.type === 'table') {
      extracted[f.key] = [];
    } else if (key.includes('gstin')) {
      const match = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z2][A-Z\d]{1}\b/i);
      if (match) extracted[f.key] = sanitizeGstin(match[0].toUpperCase());
    } else if (key.includes('invoice') || key.includes('number') || key.includes('no')) {
      const match = text.match(/(?:inv(?:oice)?|bill|po|register|patient\s*id)\s*(?:no\.?|#|number)?\s*[:.-]?\s*([A-Z0-9\/-]{3,30})/i);
      if (match) extracted[f.key] = match[1].trim();
    } else if (key.includes('total') || key.includes('amount') || key.includes('cost')) {
      const match = text.match(/(?:(?:grand\s*)?total|amount\s*payable|net\s*payable|total\s*cost|total\s*marks|balance\s*due)\s*[:.-]?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.\d{2})?)/i);
      if (match) {
        const cleaned = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(cleaned)) extracted[f.key] = cleaned;
      }
    } else if (key.includes('date')) {
      const match = text.match(/\b(\d{1,2}[-/\s.][A-Za-z]{3,9}[-/\s.]\d{2,4}|\d{4}[-/.Post]\d{2}[-/.Post]\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/i);
      if (match) {
        const iso = parseDateToISO(match[0]);
        if (iso) extracted[f.key] = iso;
      }
    } else if (key.includes('name')) {
      const match = text.match(/(?:supplier|vendor|student|patient|first\s*party)\s*(?:name)?\s*[:.-]?\s*([A-Za-z\s.]{3,50})/i);
      if (match) extracted[f.key] = match[1].trim();
    }
  }

  return postProcessExtracted(extracted, text, { fields });
};

/**
 * Call Ollama to classify document text into one of the candidate templates
 * If confidence is below 0.5 or document matches none, returns Other
 *
 * @param {string} fullText - Document text (first 6000 chars)
 * @param {Array<Object>} templates - List of candidate templates { _id, name, description, keywords }
 * @returns {Promise<{ templateId: string|null, templateName: string, confidence: number }>}
 */
const classifyDocument = async (fullText, templates = []) => {
  if (!templates || templates.length === 0) {
    return { templateId: null, templateName: 'Other', confidence: 0.3 };
  }

  const sample = (fullText || '').slice(0, 6000).toLowerCase();

  // 1. Heuristic Keyword Matching Score
  let bestCandidate = null;
  let maxScore = 0;

  for (const t of templates) {
    let score = 0;
    const nameLower = t.name.toLowerCase();
    if (sample.includes(nameLower)) score += 3;

    if (Array.isArray(t.keywords)) {
      for (const kw of t.keywords) {
        if (kw && sample.includes(kw.toLowerCase())) {
          score += 2;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestCandidate = t;
    }
  }

  // 2. Ollama Classification
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3.2';

  const candidatesList = templates
    .map((t) => `- ID: ${t._id}\n  Name: ${t.name}\n  Description: ${t.description || ''}\n  Keywords: ${(t.keywords || []).join(', ')}`)
    .join('\n\n');

  const prompt = `Classify this document into EXACTLY ONE of the following candidate document types:

${candidatesList}

Document Sample:
"""
${sample.slice(0, 4000)}
"""

Return ONLY a JSON object with:
- "templateId": the exact candidate ID string (or null if none fit)
- "templateName": candidate name (or "Other")
- "confidence": confidence between 0.0 and 1.0 (if below 0.5, use null for templateId)
- "reason": one brief sentence`;

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an expert document classifier. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0 }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const data = await response.json();
      const content = JSON.parse(data.message?.content || '{}');

      const conf = typeof content.confidence === 'number' ? content.confidence : 0.5;
      const matched = templates.find(
        (t) => t._id.toString() === String(content.templateId) || t.name.toLowerCase() === String(content.templateName).toLowerCase()
      );

      if (matched && conf >= 0.5) {
        return {
          templateId: matched._id.toString(),
          templateName: matched.name,
          confidence: parseFloat(conf.toFixed(2))
        };
      }
    }
  } catch (err) {
    // Fall back to keyword score if Ollama is unavailable
  }

  // Keyword score fallback
  if (bestCandidate && maxScore >= 2) {
    const conf = Math.min(0.9, 0.5 + maxScore * 0.1);
    return {
      templateId: bestCandidate._id.toString(),
      templateName: bestCandidate.name,
      confidence: parseFloat(conf.toFixed(2))
    };
  }

  return { templateId: null, templateName: 'Other', confidence: 0.3 };
};

/**
 * Internal single-window extraction call
 */
const extractWindow = async (windowText, template) => {
  const schema = buildSchema(template.fields || []);
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3.2';

  const fieldDescriptions = (template.fields || [])
    .map((f) => {
      let desc = `- ${f.key} (${f.type}): ${f.hint || f.label}`;
      if (f.type === 'table' && Array.isArray(f.columns)) {
        const cols = f.columns.map((c) => `${c.key} (${c.type})`).join(', ');
        desc += ` [Table columns: ${cols}]`;
      }
      return desc;
    })
    .join('\n');

  const systemPrompt = `You are an intelligent document extraction engine.
Extract structured data from the document matching the schema.
Return ONLY a valid JSON object matching the requested schema fields.
Never invent or hallucinate data. If a field is not present in the document text, return null (or [] for lists and tables).
For dates: format as YYYY-MM-DD whenever discernible.
For numbers: return clean numeric values without currency symbols or commas.
For tables: extract rows as an array of row objects containing the sub-column fields.`;

  const userPrompt = `Document Type: ${template.name}

Fields to extract:
${fieldDescriptions}

Document Text:
"""
${windowText}
"""`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: 'json',
          options: { temperature: 0 }
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) throw new Error(`Ollama status ${response.status}`);

      const json = await response.json();
      const rawContent = json.message?.content;
      if (!rawContent) throw new Error('Empty response from Ollama');

      const parsed = JSON.parse(rawContent);
      const validated = schema.safeParse(parsed);

      if (validated.success) {
        return postProcessExtracted(validated.data, windowText, template);
      } else {
        console.warn(`[Llama Validation Retry] Attempt ${attempt} schema check failed:`, validated.error.issues?.[0]?.message);
      }
    } catch (err) {
      if (attempt === 2) {
        console.warn(`[Llama Window Offline / Fallback] Ollama error (${err.message}). Using pattern extractor.`);
      }
    }
  }

  return fallbackExtract(windowText, template.fields);
};

/**
 * Call Ollama with JSON mode to extract template fields.
 * Supports windowed extraction (> 12000 chars) with 10000 window and 500 overlap.
 * Scalars: first non-null. Tables: concatenated & deduplicated.
 *
 * @param {string} fullText - Document full text
 * @param {Object} template - Template definition
 * @returns {Promise<Object>} - Extracted fields JSON
 */
const extractWithLlama = async (fullText, template) => {
  if (!template || !template.fields || template.fields.length === 0) {
    return {};
  }

  const text = (fullText || '').trim();

  // If text <= 12,000 chars, perform single extraction
  if (text.length <= 12000) {
    return extractWindow(text, template);
  }

  console.log(`[Windowed Extraction] Text length ${text.length} exceeds 12000 chars. Running windowed extraction...`);

  // Windowed extraction: 10,000 chars with 500 char overlap
  const WINDOW_SIZE = 10000;
  const STEP = 9500;
  const windowResults = [];

  for (let start = 0; start < text.length; start += STEP) {
    const chunk = text.slice(start, start + WINDOW_SIZE);
    const windowExtracted = await extractWindow(chunk, template);
    windowResults.push(windowExtracted);
  }

  // Merge results across windows
  const merged = {};

  for (const field of template.fields) {
    const key = field.key;

    if (field.type === 'table') {
      // Concatenate and deduplicate rows
      const allRows = [];
      const seenRowSignatures = new Set();

      for (const wr of windowResults) {
        const rows = wr[key];
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const sig = JSON.stringify(row);
            if (!seenRowSignatures.has(sig)) {
              seenRowSignatures.add(sig);
              allRows.push(row);
            }
          }
        }
      }
      merged[key] = allRows;
    } else if (field.type === 'list') {
      // Concatenate unique list items
      const allItems = [];
      const seenItems = new Set();

      for (const wr of windowResults) {
        const items = wr[key];
        if (Array.isArray(items)) {
          for (const item of items) {
            const str = String(item).trim();
            if (str && !seenItems.has(str.toLowerCase())) {
              seenItems.add(str.toLowerCase());
              allItems.push(str);
            }
          }
        }
      }
      merged[key] = allItems;
    } else {
      // Scalars: first non-null/non-empty value across windows
      let val = null;
      for (const wr of windowResults) {
        const v = wr[key];
        if (v !== null && v !== undefined && v !== '') {
          val = v;
          break;
        }
      }
      merged[key] = val;
    }
  }

  return postProcessExtracted(merged, text, template);
};

module.exports = {
  classifyDocument,
  extractWithLlama,
  buildSchema,
  fallbackExtract,
  sanitizeGstin,
  wordsToNumber,
  postProcessExtracted
};
