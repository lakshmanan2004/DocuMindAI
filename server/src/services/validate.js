const { Document, Extraction } = require('../models');

// Standard Indian GSTIN Regex
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

/**
 * Sanitize common OCR character confusions in GSTIN
 */
const sanitizeGstin = (val) => {
  if (!val || typeof val !== 'string') return val;
  const str = val.trim().toUpperCase();
  if (
    str.length === 15 &&
    (str[13] === '2' || str[13] === '1') &&
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[21][A-Z\d]{1}$/.test(str)
  ) {
    return str.slice(0, 13) + 'Z' + str.slice(14);
  }
  return str;
};

/**
 * Validate extracted fields against business rules
 * @param {Object} extractedValues - Key-value map of extracted field values
 * @param {string} orgId - Organization ID for tenant duplicate check
 * @param {string} currentDocumentId - Document being processed
 * @returns {Promise<Array<string>>} - List of human-readable validation issue strings
 */
const validateExtraction = async (extractedValues, orgId, currentDocumentId) => {
  const issues = [];

  // 1. GSTIN Format Check (auto-sanitizing common OCR 2->Z confusion)
  if (extractedValues.gstin) {
    const rawGstin = String(extractedValues.gstin).trim().toUpperCase();
    const sanitized = sanitizeGstin(rawGstin);
    extractedValues.gstin = sanitized;

    if (!GSTIN_REGEX.test(sanitized)) {
      issues.push(`Invalid GSTIN format: "${extractedValues.gstin}". Expected 15-character Indian GST format (e.g. 29ABCDE1234F1Z5).`);
    }
  }

  // 2. Line Items vs Grand Total Check
  if (extractedValues.total_amount !== undefined && extractedValues.total_amount !== null) {
    const total = parseFloat(extractedValues.total_amount);
    if (isNaN(total) || total < 0) {
      issues.push(`Invalid total amount value: "${extractedValues.total_amount}".`);
    } else if (Array.isArray(extractedValues.items) && extractedValues.items.length > 0) {
      const itemsSum = extractedValues.items.reduce((sum, item) => {
        const itemAmount = parseFloat(item.amount || item.total || 0);
        return sum + (isNaN(itemAmount) ? 0 : itemAmount);
      }, 0);

      // 1 rupee / dollar rounding tolerance
      if (Math.abs(itemsSum - total) > 1.0) {
        issues.push(
          `Line items sum (${itemsSum.toFixed(2)}) does not match Grand Total (${total.toFixed(2)}).`
        );
      }
    }
  }

  // 3. Duplicate Invoice Number within the Organization
  if (extractedValues.invoice_number && orgId) {
    const invoiceNum = String(extractedValues.invoice_number).trim();

    // Check existing extractions in the same organization
    const existing = await Extraction.findOne({
      orgId,
      documentId: { $ne: currentDocumentId },
      'fields.key': 'invoice_number',
      'fields.value': invoiceNum
    });

    if (existing) {
      // Verify that the referenced document still exists in the database
      const parentDoc = await Document.findById(existing.documentId);
      if (parentDoc) {
        issues.push(
          `Duplicate invoice: Invoice #${invoiceNum} has already been registered in your organization (${parentDoc.originalName}).`
        );
      } else {
        // Automatically purge orphaned extraction from deleted document
        await Extraction.deleteOne({ _id: existing._id });
      }
    }
  }

  return issues;
};

module.exports = {
  validateExtraction,
  GSTIN_REGEX
};

