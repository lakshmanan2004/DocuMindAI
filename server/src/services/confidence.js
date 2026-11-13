const KNOWN_LABELS = [
  /Invoice\s*(?:Number|No\.?|#)\s*[:.-]?/i,
  /GST\s*(?:Registration\s*No\.?|IN|No\.?)\s*[:.-]?/i,
  /Invoice\s*Date\s*[:.-]?/i,
  /\bDate\s*[:.-]?/i,
  /(?:Grand\s*)?Total\s*[:.-]?/i,
  /(?:Amount\s*in\s*Words|In\s*words)\s*[:.-]?/i
];

/**
 * Extract clean, boundary-aligned context snippet around a match index
 * Snaps cleanly to field labels, preserves whole words, and removes adjacent column noise
 * @param {string} fullText - Complete page text
 * @param {number} matchIndex - Index where value was found
 * @param {number} matchLength - Length of matched term
 * @returns {string} - Clean context snippet
 */
const extractCleanSnippet = (fullText, matchIndex, matchLength) => {
  if (!fullText || matchIndex < 0) return '';

  let start = Math.max(0, matchIndex - 60);

  // If a field label directly precedes the value on the same line, snap start directly to it
  const precedingChunk = fullText.slice(start, matchIndex);
  let snappedToLabel = false;
  for (const labelRegex of KNOWN_LABELS) {
    const labelMatch = precedingChunk.match(labelRegex);
    if (labelMatch && labelMatch.index !== undefined) {
      start = start + labelMatch.index;
      snappedToLabel = true;
      break;
    }
  }

  // If no known label, snap to preceding newline or word boundary
  if (!snappedToLabel) {
    const prevNewline = fullText.lastIndexOf('\n', matchIndex);
    if (prevNewline !== -1 && prevNewline >= start) {
      start = prevNewline + 1;
    } else {
      const spaceBefore = fullText.indexOf(' ', start);
      if (spaceBefore !== -1 && spaceBefore < matchIndex) {
        start = spaceBefore + 1;
      }
    }
  }

  let end = Math.min(fullText.length, matchIndex + matchLength + 50);
  const nextNewline = fullText.indexOf('\n', matchIndex + matchLength);
  if (nextNewline !== -1 && nextNewline <= end) {
    end = nextNewline;
  } else {
    const spaceAfter = fullText.lastIndexOf(' ', end);
    if (spaceAfter > matchIndex + matchLength) {
      end = spaceAfter;
    }
  }

  let snippet = fullText.slice(start, end).replace(/\r/g, ' ').replace(/\n+/g, ' ').trim();
  // Strip stray leading/trailing punctuation artifacts from OCR table borders
  snippet = snippet.replace(/^[|:\-_*~•[\]{}()\s]+/, '').replace(/[|:\-_*~•[\]{}()\s]+$/, '').trim();

  return snippet;
};

/**
 * Score confidence for each extracted field based on source page verification
 * and validation integrity
 *
 * Rules (from Guide Section 8):
 * - value is null -> 0
 * - value found word-for-word in the page -> 0.9 (save sourcePage and surrounding snippet)
 * - value not found in page text -> 0.4 (flags possible hallucination)
 * - validation rule failed for this field -> min(score, 0.3)
 *
 * @param {Array<Object>} templateFields - Fields defined in the template
 * @param {Object} extractedValues - Key-value map from LLM / parser
 * @param {Array<Object>} pages - List of DocumentPage records { pageNumber, text, ocrConfidence }
 * @param {Array<string>} validationIssues - List of validation issues
 * @returns {Array<Object>} - Scored field objects ready for Extraction model
 */
const scoreConfidence = (templateFields, extractedValues, pages, validationIssues = []) => {
  const issuesText = validationIssues.join(' ').toLowerCase();

  return templateFields.map((field) => {
    const rawVal = extractedValues[field.key];
    const key = field.key;

    // 1. Value is null or undefined
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
      return {
        key,
        value: null,
        confidence: 0,
        sourcePage: 1,
        sourceText: '',
        edited: false
      };
    }

    const searchStr = String(rawVal).trim().toLowerCase();
    let foundPage = 1;
    let foundSnippet = '';
    let isWordForWord = false;

    // Build candidate search terms to handle formatting differences (e.g. date ISO 2025-10-01 vs doc 01.10.2025)
    const candidates = [searchStr];

    // If it's a date in YYYY-MM-DD
    const dateMatch = searchStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const [_, y, m, d] = dateMatch;
      const monthIdx = parseInt(m, 10) - 1;
      const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][monthIdx];
      const monthLong = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][monthIdx];
      const dNum = parseInt(d, 10);

      candidates.push(`${d}.${m}.${y}`);
      candidates.push(`${d}/${m}/${y}`);
      candidates.push(`${d}-${m}-${y}`);
      candidates.push(`${m}/${d}/${y}`);
      candidates.push(`${dNum}.${parseInt(m, 10)}.${y}`);
      candidates.push(`${dNum}/${parseInt(m, 10)}/${y}`);

      if (monthShort) {
        candidates.push(`${d} ${monthShort} ${y}`);
        candidates.push(`${dNum} ${monthShort} ${y}`);
        candidates.push(`${d}-${monthShort}-${y}`);
        candidates.push(`${dNum}-${monthShort}-${y}`);
        candidates.push(`${monthShort} ${d} ${y}`);
        candidates.push(`${monthShort} ${dNum} ${y}`);
      }
      if (monthLong) {
        candidates.push(`${d} ${monthLong} ${y}`);
        candidates.push(`${dNum} ${monthLong} ${y}`);
        candidates.push(`${monthLong} ${d} ${y}`);
        candidates.push(`${monthLong} ${dNum} ${y}`);
      }
    }

    // If it's a sanitized GSTIN (with 'Z' at index 13), also check OCR '2' variation
    if (searchStr.length === 15 && searchStr[13] === 'z') {
      candidates.push(searchStr.slice(0, 13) + '2' + searchStr.slice(14));
    }

    // If it's a number (total amount, e.g. 1499 or 899)
    const numVal = parseFloat(rawVal);
    if (!isNaN(numVal)) {
      const enUsWithDec = numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const enUsNoDec = numVal.toLocaleString('en-US', { maximumFractionDigits: 0 });
      const enInWithDec = numVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const enInNoDec = numVal.toLocaleString('en-IN', { maximumFractionDigits: 0 });

      const numberFormats = new Set([
        numVal.toFixed(2),
        numVal.toString(),
        enUsWithDec,
        enUsNoDec,
        enInWithDec,
        enInNoDec
      ]);

      for (const fmt of numberFormats) {
        candidates.push(fmt);
        candidates.push(`₹${fmt}`);
        candidates.push(`₹ ${fmt}`);
        candidates.push(`3${fmt}`);  // OCR misread of ₹ as 3 (e.g. 31,499.00 or 3899.00)
        candidates.push(`r${fmt}`);  // OCR misread of ₹ as r
      }
    }

    // 2. Search for exact or candidate match across all document pages
    for (const page of pages) {
      const pageText = (page.text || '').toLowerCase();

      // Priority 1 for Total Amount: Search for explicit "Total : ...", "Grand Total : ...", "Net Payable : ..."
      // This prevents matching intermediate line-item table rows that happen to contain the same price
      if (!isNaN(numVal) && (key === 'total_amount' || key.includes('amount') || key.includes('total'))) {
        const intStr = String(Math.floor(numVal));
        if (intStr.length >= 2) {
          const flexibleDigits = intStr.split('').join('[,\\s]?');
          const totalSummaryRegex = new RegExp(`(?:(?:grand\\s*)?total|amount\\s*payable|net\\s*payable|balance\\s*due)\\s*[:.-]?\\s*(?:[₹3r]\\s*)?${flexibleDigits}(?:\\.\\d{2})?`, 'i');
          const match = page.text.match(totalSummaryRegex);
          if (match) {
            isWordForWord = true;
            foundPage = page.pageNumber;
            foundSnippet = extractCleanSnippet(page.text, match.index, match[0].length);
          }
        }
      }

      // Priority 2: General candidate match (if not already matched by priority summary)
      if (!isWordForWord) {
        for (const candidate of candidates) {
          const matchIndex = pageText.indexOf(candidate.toLowerCase());
          if (matchIndex !== -1) {
            isWordForWord = true;
            foundPage = page.pageNumber;
            foundSnippet = extractCleanSnippet(page.text, matchIndex, candidate.length);
            break;
          }
        }
      }

      // Priority 3: Resilient number pattern (handles arbitrary digit spacing/commas & currency symbols)
      if (!isWordForWord && !isNaN(numVal)) {
        const intStr = String(Math.floor(numVal));
        if (intStr.length >= 2) {
          const flexibleDigits = intStr.split('').join('[,\\s]?');
          const numPattern = new RegExp(`(?:[₹3r]\\s*)?${flexibleDigits}(?:\\.\\d{2})?`, 'i');
          const regexMatch = page.text.match(numPattern);
          if (regexMatch) {
            isWordForWord = true;
            foundPage = page.pageNumber;
            foundSnippet = extractCleanSnippet(page.text, regexMatch.index, regexMatch[0].length);
          }
        }
      }

      // Cross-link "Amount in Words" section for total_amount
      if (!isNaN(numVal) && (key === 'total_amount' || key.includes('amount') || key.includes('total'))) {
        const wordsSectionMatch = page.text.match(/(?:Amount\s*in\s*Words|In\s*words|Rupees\s*in\s*words)\s*[:.-]?\s*([A-Za-z\s-]+?)(?:only|\n|For|$)/i);
        if (wordsSectionMatch) {
          const wordsOnly = wordsSectionMatch[1].trim();
          if (foundSnippet) {
            foundSnippet = `${foundSnippet} (Amount in Words: "${wordsOnly} only")`;
          } else {
            isWordForWord = true;
            foundPage = page.pageNumber;
            foundSnippet = `Amount in Words: "${wordsOnly} only"`;
          }
        }
      }

      if (isWordForWord) break;
    }

    // Baseline confidence
    let confidence = isWordForWord ? 0.9 : 0.4;

    // 3. Validation rule check penalty: if validation issues mention this field
    const fieldKeyMentioned = issuesText.includes(key.toLowerCase());
    const gstinFailed = key === 'gstin' && issuesText.includes('gstin');
    const totalFailed = (key === 'total_amount' || key === 'items') && issuesText.includes('total');
    const duplicateFailed = key === 'invoice_number' && issuesText.includes('duplicate');

    if (fieldKeyMentioned || gstinFailed || totalFailed || duplicateFailed) {
      confidence = Math.min(confidence, 0.3);
    }

    return {
      key,
      value: rawVal,
      confidence: parseFloat(confidence.toFixed(2)),
      sourcePage: foundPage,
      sourceText: foundSnippet,
      edited: false
    };
  });
};

module.exports = {
  scoreConfidence
};

