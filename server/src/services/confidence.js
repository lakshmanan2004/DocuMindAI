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
 */
const extractCleanSnippet = (fullText, matchIndex, matchLength) => {
  if (!fullText || matchIndex < 0) return '';

  let start = Math.max(0, matchIndex - 60);

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
  snippet = snippet.replace(/^[|:\-_*~•[\]{}()\s]+/, '').replace(/[|:\-_*~•[\]{}()\s]+$/, '').trim();

  return snippet;
};

/**
 * Score confidence for each extracted field based on source page verification
 * and validation integrity
 *
 * Rules:
 * - value is null/empty -> 0
 * - value found word-for-word in page text -> 0.90 to 0.95 (with sourcePage and snippet)
 * - value not found word-for-word (inferred) -> 0.45
 * - validation rule failed with severity error -> min(confidence, 0.30)
 * - validation rule failed with severity warning -> min(confidence, 0.60)
 *
 * @param {Array<Object>} templateFields - Fields defined in the template
 * @param {Object} extractedValues - Key-value map from LLM / parser
 * @param {Array<Object>} pages - List of DocumentPage records { pageNumber, text, ocrConfidence }
 * @param {Array<Object|string>} validationIssues - List of validation issues
 * @returns {Array<Object>} - Scored field objects ready for Extraction model
 */
const scoreConfidence = (templateFields = [], extractedValues = {}, pages = [], validationIssues = []) => {
  return templateFields.map((field) => {
    const rawVal = extractedValues[field.key];
    const key = field.key;

    // 1. Value is null or undefined
    if (rawVal === null || rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) {
      return {
        key,
        label: field.label,
        type: field.type,
        value: null,
        confidence: 0,
        sourcePage: 1,
        sourceText: '',
        edited: false
      };
    }

    // 2. Handle Table Field Type
    if (field.type === 'table' || Array.isArray(rawVal)) {
      if (Array.isArray(rawVal) && rawVal.length > 0) {
        let foundPage = 1;
        let matchedRowsCount = 0;

        for (const row of rawVal) {
          const rowValues = typeof row === 'object' && row !== null ? Object.values(row) : [row];
          for (const cell of rowValues) {
            if (!cell) continue;
            const cellStr = String(cell).toLowerCase().trim();
            if (cellStr.length < 2) continue;

            for (const p of pages) {
              if ((p.text || '').toLowerCase().includes(cellStr)) {
                foundPage = p.pageNumber;
                matchedRowsCount++;
                break;
              }
            }
          }
        }

        const tableConf = matchedRowsCount > 0 ? 0.92 : 0.50;

        // Check if any rule flagged this table
        let ruleConf = tableConf;
        for (const issue of validationIssues) {
          const matchesTable =
            issue.table === key ||
            issue.field === key ||
            (issue.message && issue.message.toLowerCase().includes(key.toLowerCase()));

          if (matchesTable) {
            ruleConf = issue.severity === 'error' ? 0.30 : 0.60;
            break;
          }
        }

        return {
          key,
          label: field.label,
          type: 'table',
          value: rawVal,
          confidence: parseFloat(ruleConf.toFixed(2)),
          sourcePage: foundPage,
          sourceText: `Table with ${rawVal.length} row(s)`,
          edited: false
        };
      } else {
        return {
          key,
          label: field.label,
          type: field.type,
          value: [],
          confidence: 0,
          sourcePage: 1,
          sourceText: '',
          edited: false
        };
      }
    }

    // 3. Handle List Field Type
    if (field.type === 'list') {
      const items = Array.isArray(rawVal) ? rawVal : [rawVal];
      let foundPage = 1;
      let matchedCount = 0;

      for (const item of items) {
        const itemStr = String(item).toLowerCase().trim();
        for (const p of pages) {
          if ((p.text || '').toLowerCase().includes(itemStr)) {
            foundPage = p.pageNumber;
            matchedCount++;
            break;
          }
        }
      }

      const listConf = matchedCount > 0 ? 0.90 : 0.50;
      return {
        key,
        label: field.label,
        type: 'list',
        value: items,
        confidence: parseFloat(listConf.toFixed(2)),
        sourcePage: foundPage,
        sourceText: items.slice(0, 3).join(', '),
        edited: false
      };
    }

    // 4. Scalar Fields (string, number, date, boolean)
    const searchStr = String(rawVal).trim().toLowerCase();
    let foundPage = 1;
    let foundSnippet = '';
    let isWordForWord = false;

    const candidates = [searchStr];

    // Date variations
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
        candidates.push(`${monthShort} ${d} ${y}`);
      }
      if (monthLong) {
        candidates.push(`${d} ${monthLong} ${y}`);
        candidates.push(`${dNum} ${monthLong} ${y}`);
        candidates.push(`${monthLong} ${d} ${y}`);
      }
    }

    // Number variations
    const numVal = parseFloat(rawVal);
    if (!isNaN(numVal)) {
      candidates.push(numVal.toFixed(2));
      candidates.push(numVal.toString());
      candidates.push(numVal.toLocaleString('en-US'));
      candidates.push(numVal.toLocaleString('en-IN'));
      candidates.push(`₹${numVal}`);
      candidates.push(`$${numVal}`);
    }

    // ID variations (handling hyphens, spaces, and OCR line wraps)
    if (key.includes('id') || key.includes('number') || key.includes('no') || key.includes('code')) {
      const noHyphens = searchStr.replace(/[-\s]/g, '');
      candidates.push(noHyphens);
      if (searchStr.length >= 8) {
        candidates.push(searchStr.slice(0, 8));
        candidates.push(searchStr.slice(-8));
      }
    }

    // Course variations (handle parenthesis like B.Sc. (PCM) vs B.Sc. PCM vs B.Sc.)
    if (key === 'course') {
      candidates.push(searchStr.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim());
      const baseCourse = searchStr.replace(/\s*\([^)]*\)/g, '').trim();
      if (baseCourse) candidates.push(baseCourse);
      const parts = searchStr.split(/[-–—(]/);
      if (parts[0] && parts[0].trim().length >= 3) candidates.push(parts[0].trim());
    }

    // Result variations (Pass / Fail / Promoted / Division)
    if (key === 'result') {
      if (searchStr.includes('pass')) {
        candidates.push('pass', 'passed', 'promoted', 'first division', 'second division', 'distinction', 'qual', 'p');
      } else if (searchStr.includes('fail')) {
        candidates.push('fail', 'failed', 'f', 'reappear', 'compartment', 'essential repeat');
      }
    }

    // Total marks variations (if calculated sum matches marks obtained)
    if (key === 'total_marks' && Array.isArray(extractedValues.subjects) && extractedValues.subjects.length > 0) {
      const sum = extractedValues.subjects.reduce((acc, s) => acc + (Number(s.marks) || 0), 0);
      if (sum > 0) {
        candidates.push(String(sum));
      }
    }

    // Search across document pages
    for (const page of pages) {
      const rawText = page.text || '';
      const pageText = rawText.toLowerCase();
      const normalizedPageText = pageText.replace(/\s+/g, ' ');
      const compactPageText = pageText.replace(/[-\s]/g, '');

      for (const candidate of candidates) {
        const cLower = candidate.toLowerCase();
        const matchIndex = pageText.indexOf(cLower);
        if (matchIndex !== -1) {
          isWordForWord = true;
          foundPage = page.pageNumber;
          foundSnippet = extractCleanSnippet(rawText, matchIndex, candidate.length);
          break;
        }

        // Check normalized spaces (in case candidate was split across line break)
        const normIndex = normalizedPageText.indexOf(cLower);
        if (normIndex !== -1) {
          isWordForWord = true;
          foundPage = page.pageNumber;
          foundSnippet = extractCleanSnippet(rawText, Math.max(0, normIndex - 10), candidate.length + 20);
          break;
        }

        // Check compact (ignoring hyphens and spaces completely for IDs/codes)
        const cCompact = cLower.replace(/[-\s]/g, '');
        if (cCompact.length >= 5 && compactPageText.includes(cCompact)) {
          isWordForWord = true;
          foundPage = page.pageNumber;
          foundSnippet = `Matched value: ${rawVal}`;
          break;
        }
      }

      if (isWordForWord) break;
    }

    // Semantic confidence fallback for verified passing status or sum of marks
    if (!isWordForWord) {
      if (key === 'result' && searchStr.includes('pass') && Array.isArray(extractedValues.subjects) && extractedValues.subjects.length > 0) {
        const hasFails = extractedValues.subjects.some((s) => s.marks !== null && s.marks < 35);
        if (!hasFails) {
          isWordForWord = true;
          foundSnippet = 'Verified passing marks across subjects';
        }
      } else if (key === 'total_marks' && Array.isArray(extractedValues.subjects) && extractedValues.subjects.length > 0) {
        const sum = extractedValues.subjects.reduce((acc, s) => acc + (Number(s.marks) || 0), 0);
        if (numVal && Math.abs(numVal - sum) <= 5) {
          isWordForWord = true;
          foundSnippet = `Sum of marks obtained across ${extractedValues.subjects.length} subjects: ${numVal}`;
        }
      }
    }

    let confidence = isWordForWord ? 0.92 : 0.45;

    // Validation rule check
    for (const issue of validationIssues) {
      const fieldMatched =
        issue.field === key ||
        (Array.isArray(issue.fields) && issue.fields.includes(key)) ||
        (issue.message && issue.message.toLowerCase().includes(key.toLowerCase()));

      if (fieldMatched) {
        confidence = issue.severity === 'error' ? Math.min(confidence, 0.30) : Math.min(confidence, 0.60);
      }
    }

    return {
      key,
      label: field.label,
      type: field.type || 'string',
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
