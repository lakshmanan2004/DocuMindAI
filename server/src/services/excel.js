const ExcelJS = require('exceljs');

/**
 * Generate Excel workbook from documents and their structured extractions
 * @param {Array<Object>} documents - Document records
 * @param {Array<Object>} extractions - Corresponding Extraction records
 * @param {Array<Object>} templates - Organization Template records
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateExcelWorkbook(documents, extractions, templates) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DocuMind AI';
  wb.created = new Date();

  const ws = wb.addWorksheet('Extracted Data', {
    views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
  });

  // Collect all unique field keys across all templates or extractions
  const fieldKeyMap = new Map();

  // 1. Gather fields from templates
  for (const t of templates || []) {
    for (const f of t.fields || []) {
      if (!fieldKeyMap.has(f.key)) {
        fieldKeyMap.set(f.key, { label: f.label, type: f.type });
      }
    }
  }

  // 2. Also check extractions for any custom fields
  for (const ext of extractions || []) {
    for (const f of ext.fields || []) {
      if (!fieldKeyMap.has(f.key)) {
        fieldKeyMap.set(f.key, { label: f.key.replace(/_/g, ' ').toUpperCase(), type: 'string' });
      }
    }
  }

  // 3. Define Sheet Columns
  const columns = [
    { header: 'Document Name', key: 'originalName', width: 28 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Uploaded Date', key: 'createdAt', width: 16 }
  ];

  // Dynamic template fields
  fieldKeyMap.forEach((meta, key) => {
    columns.push({
      header: meta.label,
      key: key,
      width: Math.max(16, meta.label.length + 4)
    });
  });

  columns.push(
    { header: 'Reviewed By', key: 'reviewedBy', width: 18 },
    { header: 'Reviewed At', key: 'reviewedAt', width: 18 }
  );

  ws.columns = columns;

  // 4. Style Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo 600
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF3730A3' } },
      bottom: { style: 'medium', color: { argb: 'FF312E81' } },
      left: { style: 'thin', color: { argb: 'FF3730A3' } },
      right: { style: 'thin', color: { argb: 'FF3730A3' } }
    };
  });

  // Map extractions by documentId
  const extByDocId = new Map();
  for (const ext of extractions) {
    extByDocId.set(ext.documentId.toString(), ext);
  }

  // 5. Populate Data Rows
  documents.forEach((doc, idx) => {
    const ext = extByDocId.get(doc._id.toString());
    const rowData = {
      originalName: doc.originalName,
      status: doc.status.toUpperCase(),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : '',
      reviewedBy: ext?.reviewedBy ? 'Verified' : 'Pending',
      reviewedAt: ext?.reviewedAt ? new Date(ext.reviewedAt).toISOString().split('T')[0] : ''
    };

    // Populate extracted values
    if (ext && ext.fields) {
      for (const f of ext.fields) {
        if (f.value !== null && f.value !== undefined) {
          rowData[f.key] = f.value;
        } else {
          rowData[f.key] = '';
        }
      }
    }

    const row = ws.addRow(rowData);
    row.height = 20;

    // Zebra striping and cell formatting
    const isEven = idx % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (!isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Slate 50
        };
      }

      // Format Status badge colors
      if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (cell.value === 'COMPLETED' || cell.value === 'REVIEWED') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF059669' } };
        } else if (cell.value === 'NEEDS_REVIEW') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
        }
      }

      // Number formatting for numeric fields (e.g. total_amount)
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  });

  return wb;
}

module.exports = {
  generateExcelWorkbook
};

