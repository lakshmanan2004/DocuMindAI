const { Extraction, Document } = require('../models');

/**
 * Generic Document-Type Agnostic Validation Engine (Spec Section 5)
 * Missing values never crash a rule; a rule whose inputs are null is skipped.
 */

function validateRequired(rule, data) {
  const val = data[rule.field];
  if (
    val === null ||
    val === undefined ||
    (typeof val === 'string' && val.trim() === '') ||
    (Array.isArray(val) && val.length === 0)
  ) {
    return {
      field: rule.field,
      rule: 'required',
      message: rule.message || `${rule.field} is required`,
      severity: rule.severity || 'error'
    };
  }
  return null;
}

function validateRegex(rule, data) {
  const val = data[rule.field];
  if (val === null || val === undefined || val === '') return null;
  try {
    const reg = new RegExp(rule.pattern);
    if (!reg.test(String(val).trim())) {
      return {
        field: rule.field,
        rule: 'regex',
        message: rule.message || `${rule.field} does not match required pattern`,
        severity: rule.severity || 'error'
      };
    }
  } catch (e) {
    console.warn(`[Validation Engine] Invalid regex pattern '${rule.pattern}':`, e.message);
  }
  return null;
}

function validateNumberRange(rule, data) {
  const val = data[rule.field];
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (isNaN(num)) return null;

  if (
    (rule.min !== undefined && rule.min !== null && num < rule.min) ||
    (rule.max !== undefined && rule.max !== null && num > rule.max)
  ) {
    return {
      field: rule.field,
      rule: 'number_range',
      message: rule.message || `${rule.field} value (${num}) is outside range [${rule.min}, ${rule.max}]`,
      severity: rule.severity || 'warning'
    };
  }
  return null;
}

function validateDateOrder(rule, data) {
  const beforeVal = data[rule.before];
  const afterVal = data[rule.after];
  if (!beforeVal || !afterVal) return null;

  const dBefore = new Date(beforeVal);
  const dAfter = new Date(afterVal);
  if (isNaN(dBefore.getTime()) || isNaN(dAfter.getTime())) return null;

  if (dBefore.getTime() > dAfter.getTime()) {
    return {
      field: rule.before,
      rule: 'date_order',
      message: rule.message || `${rule.before} must precede ${rule.after}`,
      severity: rule.severity || 'warning'
    };
  }
  return null;
}

function validateTableSumEquals(rule, data) {
  const tableRows = data[rule.table];
  const targetVal = data[rule.target];
  if (!Array.isArray(tableRows) || targetVal === null || targetVal === undefined || targetVal === '') {
    return null;
  }

  const targetNum = Number(targetVal);
  if (isNaN(targetNum)) return null;

  const sum = tableRows.reduce((acc, row) => {
    const colVal = Number(row?.[rule.column]);
    return acc + (isNaN(colVal) ? 0 : colVal);
  }, 0);

  const tolerance = rule.tolerance !== undefined && rule.tolerance !== null ? Number(rule.tolerance) : 0;
  if (Math.abs(sum - targetNum) > tolerance) {
    return {
      field: rule.target,
      rule: 'table_sum_equals',
      message: rule.message || `Sum of ${rule.table}.${rule.column} (${sum.toFixed(2)}) does not equal ${rule.target} (${targetNum.toFixed(2)})`,
      severity: rule.severity || 'warning'
    };
  }
  return null;
}

function validateSumOfFieldsEquals(rule, data) {
  const fields = rule.fields || [];
  const targetVal = data[rule.target];
  if (targetVal === null || targetVal === undefined || targetVal === '') return null;

  const targetNum = Number(targetVal);
  if (isNaN(targetNum)) return null;

  let sum = 0;
  let hasAtLeastOne = false;

  for (const f of fields) {
    const val = data[f];
    if (val !== null && val !== undefined && val !== '') {
      const num = Number(val);
      if (!isNaN(num)) {
        sum += num;
        hasAtLeastOne = true;
      }
    }
  }

  if (!hasAtLeastOne) return null;

  const tolerance = rule.tolerance !== undefined && rule.tolerance !== null ? Number(rule.tolerance) : 0;
  if (Math.abs(sum - targetNum) > tolerance) {
    return {
      field: rule.target,
      rule: 'sum_of_fields_equals',
      message: rule.message || `Sum of [${fields.join(', ')}] (${sum.toFixed(2)}) does not equal ${rule.target} (${targetNum.toFixed(2)})`,
      severity: rule.severity || 'error'
    };
  }
  return null;
}

async function validateUniqueInOrg(rule, data, orgId, currentDocumentId, templateId) {
  const fields = rule.fields || [];
  if (!orgId || fields.length === 0) return null;

  const matchConditions = {
    orgId,
    ...(templateId ? { templateId } : {})
  };

  if (currentDocumentId) {
    matchConditions.documentId = { $ne: currentDocumentId };
  }

  for (const f of fields) {
    const val = data[f];
    if (val === null || val === undefined || val === '') return null; // Skip if any composite key field is missing
    matchConditions[`data.${f}`] = val;
  }

  try {
    const existing = await Extraction.findOne(matchConditions);
    if (existing) {
      return {
        field: fields[0],
        rule: 'unique_in_org',
        message: rule.message || `Duplicate document: matching [${fields.join(', ')}] already exists in your organization`,
        severity: rule.severity || 'warning'
      };
    }
  } catch (err) {
    console.warn('[Unique Check Warning]', err.message);
  }
  return null;
}

/**
 * Validate extracted data against all rules defined in a template
 * @param {Array<Object>} rules - Rule definitions from Template.rules
 * @param {Object} data - Key-value map of extracted data
 * @param {string} [orgId] - Organization ID
 * @param {string} [currentDocumentId] - Current document ID
 * @param {string} [templateId] - Template ID
 * @returns {Promise<Array<{ field: string, rule: string, message: string, severity: 'error'|'warning' }>>}
 */
const validateRules = async (rules = [], data = {}, orgId = null, currentDocumentId = null, templateId = null) => {
  const issues = [];
  if (!Array.isArray(rules) || rules.length === 0) return issues;

  for (const rule of rules) {
    let issue = null;
    switch (rule.type) {
      case 'required':
        issue = validateRequired(rule, data);
        break;
      case 'regex':
        issue = validateRegex(rule, data);
        break;
      case 'number_range':
        issue = validateNumberRange(rule, data);
        break;
      case 'date_order':
        issue = validateDateOrder(rule, data);
        break;
      case 'table_sum_equals':
        issue = validateTableSumEquals(rule, data);
        break;
      case 'sum_of_fields_equals':
        issue = validateSumOfFieldsEquals(rule, data);
        break;
      case 'unique_in_org':
        issue = await validateUniqueInOrg(rule, data, orgId, currentDocumentId, templateId);
        break;
      default:
        break;
    }
    if (issue) issues.push(issue);
  }

  return issues;
};

// Backward-compatibility alias for older code
const validateExtraction = async (extractedValues, orgId, currentDocumentId) => {
  return validateRules([], extractedValues, orgId, currentDocumentId);
};

module.exports = {
  validateRules,
  validateExtraction
};
