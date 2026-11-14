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

  const dayMonthTextMatch = str.match(/\b(\d{1,2})[-/\s]+([A-Za-z]{3,9})[-/\s]+(\d{2,4})\b/);
  if (dayMonthTextMatch) {
    const day = dayMonthTextMatch[1].padStart(2, '0');
    const monthKey = dayMonthTextMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    let year = dayMonthTextMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) return `${year}-${month}-${day}`;
  }

  const monthTextDayMatch = str.match(/\b([A-Za-z]{3,9})[-/\s]+(\d{1,2})[-/\s]+(\d{2,4})\b/);
  if (monthTextDayMatch) {
    const monthKey = monthTextDayMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const day = monthTextDayMatch[2].padStart(2, '0');
    let year = monthTextDayMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) return `${year}-${month}-${day}`;
  }

  const numMatch = str.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

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
 * Post-process extracted fields with domain normalization, date parsing, and ID cleaning
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

  // 2. ID Fields Cleaning (clean up multi-line wraps, prefix labels, or extra whitespace)
  const idFields = ['patient_id', 'register_number', 'invoice_number', 'po_number'];
  for (const idKey of idFields) {
    if (result[idKey] && typeof result[idKey] === 'string') {
      // Strip common label prefixes like "Registration ID: ", "Invoice No: ", "PO #", etc.
      let cleaned = result[idKey]
        .replace(/^(?:patient\s*(?:id|\bno\.?)|registration\s*(?:id|\bno\.?)|reg(?:istration)?\s*\bno\.?|uhid|mrn|sample\s*id|invoice\s*(?:number|\bno\.?|#)|inv\s*(?:number|\bno\.?|#)|po\s*(?:number|\bno\.?|#)|purchase\s*order\s*(?:number|\bno\.?|#)|register\s*(?:\bno\.?|number)|roll\s*\bno\.?|\bno\.?|#)\s*[:.-]?\s*/i, '')
        .trim();

      cleaned = cleaned.replace(/[\r\n]+/g, '').replace(/\s+/g, '').trim();
      result[idKey] = cleaned;
    }
  }

  // 2b. If any ID field was missed by LLM, try regex extraction from fullText directly
  if (!result.patient_id) {
    const match = fullText.match(/(?:patient\s*(?:id|no\.?)|registration\s*id|reg(?:istration)?\s*no\.?|uhid|mrn|sample\s*id|barcode)\s*[:.-]?\s*([A-Za-z0-9_/-]{3,40})/i);
    if (match) result.patient_id = match[1].trim();
  }
  if (!result.register_number) {
    const match = fullText.match(/(?:register\s*(?:no\.?|number)|registration\s*no\.?|roll\s*no\.?|enrollment\s*no\.?|prn|hall\s*ticket\s*no\.?)\s*[:.-]?\s*([A-Za-z0-9_/-]{3,40})/i);
    if (match) result.register_number = match[1].trim();
  }
  if (!result.invoice_number) {
    const match = fullText.match(/(?:invoice\s*(?:number|no\.?|#)|inv\s*(?:number|no\.?|#)|bill\s*(?:number|no\.?|#)|tax\s*invoice\s*#)\s*[:.-]?\s*([A-Za-z0-9_/-]{3,30})/i);
    if (match) result.invoice_number = match[1].trim();
  }
  if (!result.po_number) {
    const match = fullText.match(/(?:p\.?o\.?\s*(?:number|no\.?|#)|purchase\s*order\s*(?:number|no\.?|#)|order\s*(?:number|no\.?|#))\s*[:.-]?\s*([A-Za-z0-9_/-]{3,30})/i);
    if (match) result.po_number = match[1].trim();
  }
  if (!result.agreement_title) {
    const match = fullText.match(/^([^\n]{5,100}(?:AGREEMENT|CONTRACT|UNDERTAKING|MOU|DEED)[^\n]{0,100})/im);
    if (match) result.agreement_title = match[1].trim();
  }

  // 3. Invoice / Tax specifics
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

  // 4. Lab Report specifics
  if (result.patient_id) {
    const uuidMatch = fullText.match(/\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/);
    if (uuidMatch) {
      result.patient_id = uuidMatch[1];
    } else {
      result.patient_id = result.patient_id.split(/(?:phone|mobile|tel|age|sex|gender|date)/i)[0].trim();
    }
  }

  // Doctor qualification vs lab_name
  const isDoctorDegree = (name) => {
    if (!name || typeof name !== 'string') return true;
    const s = name.trim();
    return s.length < 3 || /^(?:md|mbbs|m\.d\.?|dcp|dnb|phd|pathologist|consultant|doctor|dr\.?)\b/i.test(s) || /^(?:dr\.|dr\s)/i.test(s);
  };

  if (isDoctorDegree(result.lab_name)) {
    // Generically extract the facility / laboratory name from header or letterhead text
    const facilityMatch = fullText.match(/(?:^|\n)\s*([A-Za-z0-9\s.,&'-]{3,60}?\s*(?:Laboratory|Laboratories|Diagnostics|Diagnostic\s*Centre|Hospital|Clinic|Health\s*Care|Healthcare|Medical\s*Centre|Pathology|Scan\s*Centre))\b/im);
    if (facilityMatch && !isDoctorDegree(facilityMatch[1])) {
      result.lab_name = facilityMatch[1].trim();
    } else {
      result.lab_name = null;
    }
  }

  // Report Date vs Patient DOB
  if (result.report_date) {
    const isLikelyDob = (dateStr) => {
      const y = parseInt(String(dateStr).slice(0, 4), 10);
      return !isNaN(y) && y <= 2010;
    };

    const approvedOrReportedMatch = fullText.match(/(?:Approved\s*on|Reported(?:\s*on|\s*date)?|Collected\s*on|Registration\s*on|Report\s*date|Date\s*of\s*report|Printed\s*on)\s*[:.-]?\s*([0-9A-Za-z\s.,/-]{8,25})/i);
    if (approvedOrReportedMatch) {
      const parsedApproved = parseDateToISO(approvedOrReportedMatch[1]);
      if (parsedApproved && (isLikelyDob(result.report_date) || parsedApproved !== result.report_date)) {
        result.report_date = parsedApproved;
      }
    } else if (isLikelyDob(result.report_date)) {
      const allDates = fullText.match(/\b(\d{1,2}[-/\s.][A-Za-z]{3,9}[-/\s.]\d{2,4}|\d{4}[-/.Post]\d{2}[-/.Post]\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/gi) || [];
      for (const d of allDates) {
        const iso = parseDateToISO(d);
        if (iso && parseInt(iso.slice(0, 4), 10) >= 2015) {
          result.report_date = iso;
          break;
        }
      }
    }
  }

  // Tests table grounding & value/unit splitting & method removal
  const METHOD_BLACKLIST = new Set([
    'calculated', 'derived', 'microscopic', 'colorimetric', 'electrical impedance',
    'copper tartrate to colour complex', 'azobilirubin chromophores', 'creatinine amidohydrolase',
    'urease, colorimetric', 'uricase', 'arsenazo iii', 'uv with p5p, ifcc', 'uv with p5p',
    'direct- ise', 'direct ise', 'pta/mgcl2', 'sf cube cell analysis', 'god-pod', 'clia', 'chemiluminescence',
    'chromatography', 'spectrophotometry', 'turbidimetry', 'nephelometry', 'end of report', 'direct measured'
  ]);

  if (Array.isArray(result.tests) && result.tests.length > 0) {
    const lowerDoc = fullText.toLowerCase();
    result.tests = result.tests
      .filter((t) => {
        if (!t || !t.test_name || typeof t.test_name !== 'string') return false;
        let name = t.test_name.trim();
        const nameLower = name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
        if (METHOD_BLACKLIST.has(nameLower)) return false;
        if (nameLower.length > 55) return false; // Commentary / paragraphs
        if (/^(?:increased in|decreased in|interpretation|limitations|additional information|explanation|due to|all results|this test|mild to moderate|psa is|ige mediates|hba1c|total haemoglobin|in random)\b/i.test(name)) return false;
        if (/^(?:colorimetric|calculated|derived|microscopic|direct measured)\b/i.test(name)) return false;

        const nameTokens = name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const appearsInDoc = nameTokens.length > 0 && nameTokens.some((token) => lowerDoc.includes(token));
        return appearsInDoc;
      })
      .map((t) => {
        let name = t.test_name.trim().replace(/\s+(?:mg\/dL|g\/dL|mmol\/L|ng\/mL|pg\/mL|microIU\/mL|million\/cmm|fL|pg|%|\/cmm|U\/L)\b/gi, '').trim();
        let val = t.value ? String(t.value).trim() : null;
        let unit = t.unit ? String(t.unit).trim() : null;
        let ref = t.reference_range ? String(t.reference_range).trim() : null;
        let flag = t.flag ? String(t.flag).trim() : null;

        if (flag && (flag.toLowerCase() === 'null' || METHOD_BLACKLIST.has(flag.toLowerCase()))) flag = null;
        if (unit && (unit.toLowerCase() === 'null' || unit === '0' || unit === 'Concentration' || unit === 'Area %')) unit = null;

        // Split unit from value if needed
        if (val) {
          const unitSplit = val.match(/^([0-9.,><=-]+)\s*([A-Za-z/μ%^0-9*-]+(?:\s*[A-Za-z/μ%^0-9*-]+)*)$/);
          if (unitSplit) {
            val = unitSplit[1].trim();
            if (!unit) unit = unitSplit[2].trim();
          }
        }

        // Swap if value has range and ref is single number
        const isRange = (s) => s && (/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/.test(s) || /^[<>=]\s*\d+/.test(s) || /^(?:normal|desirable|optimal|borderline)/i.test(s));
        const isSingleNumber = (s) => s && /^[0-9]+(?:\.[0-9]+)?$/.test(s.replace(/,/g, ''));
        if (isRange(val) && isSingleNumber(ref)) {
          const temp = val;
          val = ref;
          ref = temp;
        }

        return {
          test_name: name,
          value: val || null,
          unit: unit || null,
          reference_range: ref || null,
          flag: flag || null
        };
      });
  }

  // 5. Mark Sheet specifics
  // Look for specific School / College / Institute line (School name takes priority over educational board)
  const docLines = fullText.split(/[\r\n]+/);
  let detectedSchool = null;

  for (const line of docLines) {
    const trimmed = line.trim();
    const labelMatch = trimmed.match(/\b(?:(?:विद्यालय\s*)?School(?:\s*name|name)?|College(?:\s*name|name)?|Institute(?:\s*name|name)?)\s*[:+.-]?\s*([A-Za-z0-9\s.,&'()-]{4,100})/i);
    if (labelMatch) {
      let cand = labelMatch[1].replace(/^name\s*[:+.-]?\s*/i, '').trim();
      if (!/^(?:examination|board|leaving|statement|result|education|standards?)/i.test(cand) && cand.length >= 5) {
        detectedSchool = cand;
        break;
      }
    }
  }

  if (detectedSchool) {
    result.institution = detectedSchool;
  } else if (!result.institution || result.institution.length < 3 || /^(?:not\s*specified|null|n\/a|institution|college|school)$/i.test(result.institution)) {
    const instLabelMatch = fullText.match(/(?:Name\s*of\s*(?:Institute|Institution|School|College|University|Academy)|Institution\s*Name)\s*[:+.-]?\s*([^\n\r]+)/i);
    if (instLabelMatch) {
      result.institution = instLabelMatch[1].trim();
    } else {
      // Look at the top masthead lines (first 10 lines)
      for (const line of docLines.slice(0, 10)) {
        const trimmed = line.trim();
        if (/\b(?:University|Institute|College|School|Academy|Vidyalaya|Polytechnic)\b/i.test(trimmed) && trimmed.length >= 8 && !/^(?:statement|marksheet|report|marks card)/i.test(trimmed)) {
          result.institution = trimmed;
          break;
        }
      }
    }
  }

  // Clean institution of joined metadata (Enrollment No, Roll No, Affiliated to, etc.)
  if (result.institution && typeof result.institution === 'string') {
    result.institution = result.institution
      .replace(/(?:Enrollment\s*(?:No\.?|Number)|Roll\s*(?:No\.?|Number)|Reg(?:istration)?\s*(?:No\.?|Number)|Affiliated|Phone|Email|Address|Established).*$/i, '')
      .replace(/^[+~:.-]+/, '')
      .replace(/[+~:.-]+$/, '')
      .trim();
  }

  // Generic Course / Degree Extraction
  const schoolCourseMatch = fullText.match(/\b(SECONDARY\s*SCHOOL\s*EXAMINATION|SECONDARY\s*SCHOOL\s*LEAVING\s*CERTIFICATE|SENIOR\s*SCHOOL\s*CERTIFICATE\s*EXAMINATION|HIGHER\s*SECONDARY\s*(?:SCHOOL\s*)?EXAMINATION|X\s*STANDARD|XII\s*STANDARD)\b/i);
  if (schoolCourseMatch) {
    result.course = schoolCourseMatch[0].replace(/\s+/g, ' ').trim();
  } else if (!result.course || result.course.length < 3 || /^(?:not\s*specified|null|n\/a)$/i.test(result.course)) {
    const courseMatch = fullText.match(/\b(Bachelor\s*of\s*[A-Za-z\s]+|Master\s*of\s*[A-Za-z\s]+|B\.?[A-Za-z]{2,5}(?:\s*\([A-Za-z\s&,.-]+\))?|M\.?[A-Za-z]{2,5}(?:\s*\([A-Za-z\s&,.-]+\))?|Diploma\s*in\s*[A-Za-z\s]+|Class\s*(?:X|XII|10th|12th)|\bX\s*STANDARD\b)\b/i);
    if (courseMatch) result.course = courseMatch[0].trim();
  } else {
    result.course = result.course.replace(/~.*$/, '').trim();
    const branchMatch = fullText.match(/\b(B\.?[A-Za-z]{2,5}|M\.?[A-Za-z]{2,5})\s*\([A-Za-z\s&,.-]+\)/i);
    if (branchMatch && !result.course.includes('(')) {
      result.course += ` - ${branchMatch[0]}`;
    }
  }

  // School mark sheets (Class X, XII, Secondary School, SSLC, CBSE, Matric) do NOT have semesters
  const isSchoolCertificate = /\b(?:School|SSLC|HSC|Secondary\s*School|High\s*School|Matric|CBSE|ICSE|Class\s*(?:X|XII|10|12)|\d+(?:th)?\s*Standard)\b/i.test(fullText);
  if (isSchoolCertificate) {
    result.semester = null;
  } else {
    // Semester vs Academic Year for college/university
    const hasSem1 = /\b(?:I|1st)\s*SEMESTER\b/i.test(fullText);
    const hasSem2 = /\b(?:II|2nd)\s*SEMESTER\b/i.test(fullText);
    if (hasSem1 && hasSem2) {
      result.semester = 'Semester I & II';
    } else if (hasSem1) {
      result.semester = 'Semester I';
    } else if (hasSem2) {
      result.semester = 'Semester II';
    } else if (!result.semester || /^(?:not\s*specified|null|n\/a)$/i.test(result.semester)) {
      const semMatch =
        fullText.match(/\b(First|Second|Third|Fourth|Final|\d+(?:st|nd|rd|th)?)\s*Year\b/i) ||
        fullText.match(/\b(Semester\s*[-:]?\s*(?:[IVXLCDM\d]+|\d+(?:st|nd|rd|th)?)|Sem\s*[-:]?\s*[IVXLCDM\d]+)\b/i);
      if (semMatch) {
        result.semester = semMatch[0].trim();
      } else {
        result.semester = null;
      }
    }
  }

  // A semester should never be a date or exam month/year (like MAR 2020)
  if (result.semester && /\b(?:\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(result.semester)) {
    result.semester = null;
  }

  // Exam session
  const sessionMatch =
    fullText.match(/(?:Session|Exam(?:\s*session)?)\s*[:.-]?\s*([A-Za-z]{3,9}\s*\d{4}|\d{4}\s*[-–]\s*\d{2,4}|\b\d{4}\b)/i) ||
    fullText.match(/(?:SECONDARY\s*SCHOOL\s*EXAMINATION|HIGHER\s*SECONDARY\s*EXAMINATION|BOARD\s*EXAMINATION|EXAMINATION)[,\s]+(\d{4})/i);
  if (sessionMatch) {
    result.exam_session = sessionMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    if (result.exam_session && fullText.includes(String(result.exam_session).trim())) {
      result.exam_session = String(result.exam_session).trim();
    } else {
      result.exam_session = null;
    }
  }

  // Subjects table extraction & cleanup
  if (Array.isArray(result.subjects) && result.subjects.length > 0) {
    const lowerDoc = fullText.toLowerCase();
    const docLines = fullText.split(/[\r\n]+/);

    result.subjects = result.subjects
      .map((s) => {
        if (!s) return null;
        let code = s.code ? String(s.code).trim() : null;
        let name = s.name ? String(s.name).trim() : '';
        let marks = s.marks !== null && s.marks !== undefined && !isNaN(Number(s.marks)) ? Number(s.marks) : null;
        let grade = s.grade ? String(s.grade).trim() : null;

        // Discard header rows mistakenly parsed as subjects (e.g. "THEORY", "PRACTICAL", "SUBJECT", "MARKS OBTAINED")
        const isHeaderWord = (str) =>
          /^(?:theory|practical|internal|external|assessment|maximum|marks\s*obtained|total|minimum|credit|status|grade|subjed|subject\s*code|subject\s*name)\b/i.test(String(str || '').trim());
        if (isHeaderWord(name) || isHeaderWord(code)) {
          return null;
        }

        // Detect if subject name was mistakenly placed into code (e.g. code: "TAMIL", name: "078 ZERO SEVEN")
        const numberWordsRegex = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|seventy|eighty|ninety|hundred)\b/i;
        if (code && !/\d/.test(code) && (numberWordsRegex.test(name) || /^\d+/.test(name))) {
          name = code;
          code = null;
        }

        // Clean subject name of trailing numeric words or leaked numbers
        name = name
          .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|seventy|eighty|ninety|hundred).*$/i, '')
          .replace(/\s*\d+.*$/, '')
          .replace(/^[|:\-_*~•[\]{}()\s]+/, '')
          .replace(/[|:\-_*~•[\]{}()\s]+$/, '')
          .trim();

        if (!name || name.length < 2) return null;

        // Clean code: if code equals name, or equals course, or is excessively long (>12 chars), or is placeholder
        if (code) {
          const codeLower = code.toLowerCase();
          if (
            codeLower === name.toLowerCase() ||
            (result.course && codeLower === result.course.toLowerCase()) ||
            code.length > 12 ||
            /^(?:none|null|n\/a|nil|-)$/i.test(code)
          ) {
            code = null;
          }
        }

        // Discard summary rows
        if (/^(?:total|grand\s*total|grace\s*marks|carryover|result|examination|session|semester|controller|registrar|cgpa|sgpa)\b/i.test(name)) {
          return null;
        }

        let theory = s.theory !== null && s.theory !== undefined && !isNaN(Number(s.theory)) ? Number(s.theory) : null;
        let practical = s.practical !== null && s.practical !== undefined && !isNaN(Number(s.practical)) ? Number(s.practical) : null;

        // Grounding: find the line corresponding to this subject in fullText
        const subjectLine = docLines.find((l) => l.toLowerCase().includes(name.toLowerCase()));
        if (subjectLine) {
          // Look for triad of numbers (e.g. "052 018 070" or "054 025 079") where Theory + Practical = Total
          const numTriad = subjectLine.match(/\b(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\b/);
          if (numTriad) {
            const n1 = parseInt(numTriad[1], 10);
            const n2 = parseInt(numTriad[2], 10);
            const n3 = parseInt(numTriad[3], 10);
            if (n1 + n2 === n3) {
              theory = n1;
              practical = n2;
              marks = n3; // ALWAYS use the final Total mark (Theory + Internal/Practical)
            }
          } else {
            // Check for single 2-3 digit mark e.g. "078 ZERO SEVEN"
            const singleMatch = subjectLine.match(/\b0?([1-9]\d{1,2})\s+(?:ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|SEVENTY|EIGHTY|NINETY)\b/i);
            if (singleMatch) {
              marks = parseInt(singleMatch[1], 10);
              // If there was no practical component, theory and practical remain null (blank)
              theory = null;
              practical = null;
            }
          }

          // Extract positional grade (C1, B2, A2, A1, D1, P, PASS)
          const gradeMatch = subjectLine.match(/\b([A-E][1-2]|[A-F][+-]?|P|PASS)\b(?:\s*\(|\s*$|\s+[A-Za-z]|$)/i);
          if (gradeMatch && (!grade || grade === 'null')) {
            grade = gradeMatch[1].toUpperCase();
          }
        }

        // Clean grade: allow letter grades (A+, B, P, PASS) and positional grades (C1, B2, A2, D1).
        // Discard purely numeric sessional marks (e.g. 23, 12).
        const isValidGrade = (g) => /^(?:[A-E][1-2]|[A-F][+-]?|O|P|F|PASS|FAIL)$/i.test(String(g || '').trim());
        if (grade && !isValidGrade(grade)) {
          grade = null;
        }

        return {
          code: code || null,
          name: name,
          theory: theory !== null ? theory : null,
          practical: practical !== null ? practical : null,
          marks: marks !== null ? marks : null,
          grade: grade || null
        };
      })
      .filter(Boolean);
  }

  // Total Marks (Marks Obtained)
  const sumOfSubjectMarks = Array.isArray(result.subjects)
    ? result.subjects.reduce((sum, s) => sum + (Number(s.marks) || 0), 0)
    : 0;

  const grandTotalMatch = fullText.match(/(?:Grand\s*Total|Total\s*(?:Marks)?\s*Obtained|Marks\s*Obtained)\s*[:.-]?\s*([0-9]{2,4})(?:\s*[\/|]\s*([0-9]{2,4}))?/i);
  if (grandTotalMatch) {
    const marksNum = parseFloat(grandTotalMatch[1]);
    if (!isNaN(marksNum) && marksNum > 50) {
      result.total_marks = marksNum;
    }
  }

  // If total_marks is missing or captured the maximum round marks (e.g. 500, 600, 1000, 1200, 1250) instead of marks obtained
  const isLikelyMaxMarks = (num) => num && (num % 50 === 0 || num % 100 === 0) && num > sumOfSubjectMarks;
  if (sumOfSubjectMarks > 0 && (!result.total_marks || isLikelyMaxMarks(result.total_marks) || Math.abs(result.total_marks - sumOfSubjectMarks) > 5)) {
    result.total_marks = sumOfSubjectMarks;
  }

  // Percentage extraction & calculation
  if (!result.percentage || isNaN(Number(result.percentage))) {
    const percentMatch = fullText.match(/(?:Percentage|Aggregate|Total\s*Percentage)\s*[:.-]?\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*%/i);
    if (percentMatch) {
      result.percentage = parseFloat(percentMatch[1]);
    } else if (result.total_marks && Array.isArray(result.subjects) && result.subjects.length > 0) {
      const maxMarks = result.subjects.length * 100;
      if (maxMarks > 0 && result.total_marks <= maxMarks) {
        result.percentage = parseFloat(((result.total_marks / maxMarks) * 100).toFixed(2));
      }
    }
  } else {
    result.percentage = parseFloat(Number(result.percentage).toFixed(2));
  }

  // Result (Pass/Fail)
  const resultMatch = fullText.match(/\b(PASS|PASSED|FAIL|FAILED|PROMOTED|FIRST\s*DIVISION|SECOND\s*DIVISION|DISTINCTION)\b/i);
  if (resultMatch) {
    const r = resultMatch[1].toUpperCase();
    result.result = r === 'PASS' || r === 'PASSED' || r === 'PROMOTED' || r.includes('DIVISION') || r === 'DISTINCTION' ? 'Pass' : r === 'FAIL' || r === 'FAILED' ? 'Fail' : resultMatch[1];
  } else if (!result.result || /^(?:not\s*specified|null|n\/a)$/i.test(result.result)) {
    // Infer from subjects: if all marks >= 35, student passed
    if (Array.isArray(result.subjects) && result.subjects.length > 0) {
      const allPassed = result.subjects.every((s) => s.marks === null || s.marks >= 35);
      result.result = allPassed ? 'Pass' : 'Fail';
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
    } else if (key === 'patient_id' || key.includes('patient_id') || key.includes('uhid')) {
      const match = text.match(/(?:patient\s*(?:id|no\.?)|registration\s*id|reg(?:istration)?\s*no\.?|uhid|mrn|sample\s*id|barcode)\s*[:.-]?\s*([A-Za-z0-9_-\s]{3,60})/i);
      if (match) {
        const rawId = match[1].split(/[\r\n]+/)[0].replace(/\s+/g, '').trim();
        if (rawId) extracted[f.key] = rawId;
      }
    } else if (key === 'agreement_title' || key.includes('title')) {
      const match = text.match(/^([^\n]{5,100}(?:AGREEMENT|CONTRACT|UNDERTAKING|MOU|DEED)[^\n]{0,100})/im);
      if (match) extracted[f.key] = match[1].trim();
    } else if (key === 'register_number' || key.includes('register') || key.includes('roll')) {
      const match = text.match(/(?:register\s*(?:no\.?|number)|registration\s*no\.?|roll\s*no\.?|enrollment\s*no\.?|prn|hall\s*ticket\s*no\.?)\s*[:.-]?\s*([A-Za-z0-9\/-]{3,40})/i);
      if (match) extracted[f.key] = match[1].trim();
    } else if (key === 'po_number' || key.includes('po_number') || key.includes('po_no')) {
      const match = text.match(/(?:p\.?o\.?\s*(?:number|no\.?|#)|purchase\s*order\s*(?:number|no\.?|#)|order\s*(?:number|no\.?|#))\s*[:.-]?\s*([A-Za-z0-9\/-]{3,30})/i);
      if (match) extracted[f.key] = match[1].trim();
    } else if (key === 'invoice_number' || key.includes('invoice') || key.includes('inv')) {
      const match = text.match(/(?:invoice\s*(?:number|no\.?|#)|inv\s*(?:number|no\.?|#)|bill\s*(?:number|no\.?|#)|tax\s*invoice\s*#)\s*[:.-]?\s*([A-Za-z0-9\/-]{3,30})/i);
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
 * Deterministic domain anchor score to prevent cross-type confusion (e.g. Lab Report vs Purchase Order)
 */
const calculateDomainAnchorScore = (templateName, sampleText) => {
  const text = sampleText.toLowerCase();
  let anchorScore = 0;

  if (templateName === 'Lab Report') {
    const medicalAnchors = [
      'patient', 'specimen', 'diagnostic', 'laboratory', 'pathology',
      'blood', 'hemoglobin', 'reference interval', 'clinical', 'sample lab',
      'investigation', 'urine', 'cbc', 'wbc', 'platelet', 'serum',
      'test details', 'referring doctor', 'age / gender', 'fasting blood sugar'
    ];
    let hits = 0;
    for (const anchor of medicalAnchors) {
      if (text.includes(anchor)) hits++;
    }
    if (hits >= 2) anchorScore += hits * 4;
  } else if (templateName === 'Mark Sheet') {
    const academicAnchors = [
      'semester', 'marks', 'grade', 'exam session', 'subjects',
      'transcript', 'grade card', 'statement of marks', 'register number',
      'cgpa', 'sgpa', 'pass / fail', 'institution', 'bachelor of'
    ];
    let hits = 0;
    for (const anchor of academicAnchors) {
      if (text.includes(anchor)) hits++;
    }
    if (hits >= 2) anchorScore += hits * 4;
  } else if (templateName === 'Invoice') {
    const invoiceAnchors = [
      'tax invoice', 'gstin', 'cgst', 'sgst', 'igst',
      'invoice number', 'taxable amount', 'taxable value', 'bill to',
      'amount in words', 'bill of supply'
    ];
    let hits = 0;
    for (const anchor of invoiceAnchors) {
      if (text.includes(anchor)) hits++;
    }
    if (hits >= 2) anchorScore += hits * 4;
  } else if (templateName === 'Purchase Order') {
    const poAnchors = [
      'purchase order', 'po number', 'p.o. number', 'vendor name',
      'delivery date', 'ship to', 'shipping address', 'po date'
    ];
    let hits = 0;
    for (const anchor of poAnchors) {
      if (text.includes(anchor)) hits++;
    }
    if (hits >= 2) anchorScore += hits * 4;
  } else if (templateName === 'Contract or Agreement') {
    const legalAnchors = [
      'agreement', 'contract', 'parties hereto', 'governing law',
      'whereas', 'in witness whereof', 'termination clause', 'terms of agreement',
      'effective date', 'end date', 'first party', 'second party'
    ];
    let hits = 0;
    for (const anchor of legalAnchors) {
      if (text.includes(anchor)) hits++;
    }
    if (hits >= 2) anchorScore += hits * 4;
  }

  return anchorScore;
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

  const sample = (fullText || '').slice(0, 8000).toLowerCase();

  // 1. High-Precision Domain Anchor Rules (Deterministic Ground Truth)
  // Lab Report
  const hasLabTitle =
    sample.includes('laboratory') ||
    sample.includes('pathology') ||
    sample.includes('diagnostic report') ||
    sample.includes('lab report') ||
    sample.includes('sample lab') ||
    sample.includes('test report');
  const hasMedicalTerms =
    sample.includes('blood') ||
    sample.includes('cholesterol') ||
    sample.includes('serum') ||
    sample.includes('hemoglobin') ||
    sample.includes('urine') ||
    sample.includes('specimen') ||
    sample.includes('triglyceride') ||
    sample.includes('wbc') ||
    sample.includes('rbc') ||
    sample.includes('platelet') ||
    sample.includes('reference range') ||
    sample.includes('reference interval') ||
    sample.includes('lipid profile');
  const hasPatient =
    sample.includes('patient') ||
    sample.includes('uhid') ||
    sample.includes('doctor') ||
    sample.includes('sample id') ||
    sample.includes('age / gender') ||
    sample.includes('sex/age');

  if ((hasLabTitle && (hasMedicalTerms || hasPatient)) || (hasPatient && hasMedicalTerms)) {
    const labTmpl = templates.find((t) => t.name.toLowerCase().includes('lab'));
    if (labTmpl) {
      return { templateId: labTmpl._id.toString(), templateName: labTmpl.name, confidence: 1.0 };
    }
  }

  // Mark Sheet
  const hasAcademicTitle =
    sample.includes('statement of marks') ||
    sample.includes('mark sheet') ||
    sample.includes('marks card') ||
    sample.includes('grade card') ||
    sample.includes('transcript');
  const hasAcademicTerms =
    (sample.includes('semester') || sample.includes('exam session')) &&
    (sample.includes('marks') ||
      sample.includes('grade') ||
      sample.includes('cgpa') ||
      sample.includes('sgpa') ||
      sample.includes('subjects'));
  if (hasAcademicTitle || hasAcademicTerms) {
    const markTmpl = templates.find((t) => t.name.toLowerCase().includes('mark'));
    if (markTmpl) {
      return { templateId: markTmpl._id.toString(), templateName: markTmpl.name, confidence: 1.0 };
    }
  }

  // Invoice
  const hasInvoiceTitle = sample.includes('tax invoice') || sample.includes('bill of supply');
  const hasTaxTerms =
    sample.includes('gstin') ||
    (sample.includes('invoice') &&
      (sample.includes('cgst') ||
        sample.includes('sgst') ||
        sample.includes('igst') ||
        sample.includes('taxable amount') ||
        sample.includes('taxable value')));
  if (hasInvoiceTitle || hasTaxTerms) {
    const invTmpl = templates.find((t) => t.name.toLowerCase().includes('invoice'));
    if (invTmpl) {
      return { templateId: invTmpl._id.toString(), templateName: invTmpl.name, confidence: 1.0 };
    }
  }

  // Purchase Order
  const hasPoTitle =
    sample.includes('purchase order') ||
    sample.includes('p.o. number') ||
    sample.includes('p.o. no') ||
    (sample.includes('po number') && (sample.includes('vendor') || sample.includes('delivery date')));
  if (hasPoTitle) {
    const poTmpl = templates.find((t) => t.name.toLowerCase().includes('purchase'));
    if (poTmpl) {
      return { templateId: poTmpl._id.toString(), templateName: poTmpl.name, confidence: 1.0 };
    }
  }

  // Contract or Agreement
  const hasLegalTitle =
    sample.includes('agreement') ||
    sample.includes('contract') ||
    sample.includes('memorandum of understanding') ||
    sample.includes('nda');
  const hasLegalTerms =
    sample.includes('parties hereto') ||
    sample.includes('governing law') ||
    sample.includes('in witness whereof') ||
    (sample.includes('parties') &&
      (sample.includes('effective date') || sample.includes('termination clause')));
  if (hasLegalTitle && hasLegalTerms) {
    const contractTmpl = templates.find(
      (t) => t.name.toLowerCase().includes('contract') || t.name.toLowerCase().includes('agreement')
    );
    if (contractTmpl) {
      return {
        templateId: contractTmpl._id.toString(),
        templateName: contractTmpl.name,
        confidence: 1.0
      };
    }
  }

  // 2. Keyword & Domain Anchor Scoring for Custom Templates
  let bestCandidate = null;
  let maxScore = 0;

  for (const t of templates) {
    let score = 0;
    const nameLower = t.name.toLowerCase();

    if (sample.includes(nameLower)) score += 5;

    if (Array.isArray(t.keywords)) {
      for (const kw of t.keywords) {
        if (!kw || kw.length < 2) continue;
        const kwEscaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${kwEscaped}\\b`, 'i');
        if (regex.test(sample)) {
          score += 3;
        }
      }
    }

    score += calculateDomainAnchorScore(t.name, sample);

    if (score > maxScore) {
      maxScore = score;
      bestCandidate = t;
    }
  }

  // 3. Ollama Classification with Explicit Candidate Names
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3.2';

  const candidatesList = templates
    .map(
      (t) =>
        `- Name: ${t.name}\n  Description: ${t.description || ''}\n  Keywords: ${(t.keywords || []).join(', ')}`
    )
    .join('\n\n');

  const prompt = `Classify this document into EXACTLY ONE of the following candidate document types:

${candidatesList}

Classification Rules:
- If document contains clinical/medical test results, laboratory investigations, pathology, patient details, blood, hemoglobin, or reference ranges, it is a LAB REPORT.
- If document contains academic marks, semester, subjects, grades, or transcripts, it is a MARK SHEET.
- If document contains tax invoice, GSTIN, CGST/SGST/IGST breakdown, it is an INVOICE.
- If document is a commercial purchase order sent to a vendor with a PO number, it is a PURCHASE ORDER.
- If document contains clauses, covenants, or terms between contracting parties, it is a CONTRACT OR AGREEMENT.

Document Sample:
"""
${sample.slice(0, 4000)}
"""

Return ONLY a JSON object with:
- "templateName": candidate name matching one of the names above (or "Other")
- "confidence": confidence between 0.0 and 1.0 (if below 0.5, use "Other")
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
      signal: AbortSignal.timeout(25000)
    });

    if (response.ok) {
      const data = await response.json();
      const content = JSON.parse(data.message?.content || '{}');

      const conf = typeof content.confidence === 'number' ? content.confidence : 0.5;
      const matched = templates.find(
        (t) => t.name.toLowerCase() === String(content.templateName).toLowerCase()
      );

      // Verify Llama's choice is not a hallucination
      if (matched && conf >= 0.5) {
        if (matched.name === 'Purchase Order' && !sample.includes('purchase order') && !sample.includes('po number') && !sample.includes('p.o.')) {
          console.warn('[Classifier] Rejected LLM hallucination for Purchase Order on non-PO document');
        } else {
          return {
            templateId: matched._id.toString(),
            templateName: matched.name,
            confidence: parseFloat(conf.toFixed(2))
          };
        }
      }
    }
  } catch (err) {
    // Fall back to score
  }

  // Anchor + Keyword fallback
  if (bestCandidate && maxScore >= 4) {
    const conf = Math.min(0.95, 0.6 + maxScore * 0.05);
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

      // Enriched context for specific domain fields
      if (f.key === 'patient_id') {
        desc += ' [Look for Registration ID, Patient ID, UHID, MRN, Sample ID, Barcode, or Patient No; exclude any following phone numbers]';
      } else if (f.key === 'lab_name') {
        desc += ' [Facility/Hospital/Laboratory institution name e.g. Sterling Accuris Pathology Laboratory, Sample Lab. NEVER return doctor degrees or titles like MD Path, MBBS, M.D., DCP, Pathologist]';
      } else if (f.key === 'report_date') {
        desc += ' [Date report was approved, issued, collected or printed in YYYY-MM-DD. NEVER use patient Date of Birth (DOB) or age]';
      } else if (f.key === 'tests') {
        desc += ' [Extract ONLY tests that appear in the document text with their actual values and units. Do NOT hallucinate random tests]';
      } else if (f.key === 'course') {
        desc += ' [Degree program e.g. Bachelor of Science, B.Sc. (PCM), B.Tech, B.E., Diploma, Class XII]';
      } else if (f.key === 'semester') {
        desc += ' [Semester or Year e.g. First Year, 1st Year, 5th Semester, Sem V]';
      } else if (f.key === 'exam_session') {
        desc += ' [Exam session e.g. Nov-Dec 2026. If not mentioned on mark sheet, return null. Do NOT return "Not specified"]';
      } else if (f.key === 'subjects') {
        desc += ' [Extract ONLY actual subjects with their marks from the marks table. Do not guess names from random OCR letters]';
      } else if (f.key === 'register_number') {
        desc += ' [Look for Register Number, Registration No, Roll No, Enrollment No, PRN, Hall Ticket No]';
      } else if (f.key === 'invoice_number') {
        desc += ' [Look for Invoice Number, Inv No, Bill No, Tax Invoice #]';
      } else if (f.key === 'po_number') {
        desc += ' [Look for PO Number, Purchase Order Number, P.O. No, Order No]';
      }

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
For identifiers (IDs, numbers): extract the exact alphanumeric value without labels. If an ID is wrapped across lines, join it without whitespace.
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
        signal: AbortSignal.timeout(25000)
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

  const WINDOW_SIZE = 10000;
  const STEP = 9500;
  const windowResults = [];

  for (let start = 0; start < text.length; start += STEP) {
    const chunk = text.slice(start, start + WINDOW_SIZE);
    const windowExtracted = await extractWindow(chunk, template);
    windowResults.push(windowExtracted);
  }

  const merged = {};

  for (const field of template.fields) {
    const key = field.key;

    if (field.type === 'table') {
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
