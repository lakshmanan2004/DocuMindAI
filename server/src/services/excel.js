const ExcelJS = require('exceljs');

/**
 * Generate a multi-worksheet Excel workbook containing:
 * 1. "Documents Overview" - Global high-level catalog of all documents
 * 2. Per-Template Worksheets - Separate sheets grouped by template (e.g. "Invoices", "Marksheets")
 * 3. Table Field Worksheets - Separate dedicated sheets for nested table data (e.g. "Items", "Subjects")
 *
 * @param {Array<Object>} documents - Document records
 * @param {Array<Object>} extractions - Corresponding Extraction records
 * @param {Array<Object>} templates - Organization Template records
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateExcelWorkbook(documents, extractions, templates) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DocuMind AI';
  wb.created = new Date();

  // Map extractions by documentId string
  const extByDocId = new Map();
  for (const ext of extractions || []) {
    extByDocId.set(ext.documentId.toString(), ext);
  }

  // Map templates by templateId string and name
  const templateMap = new Map();
  for (const t of templates || []) {
    templateMap.set(t._id.toString(), t);
  }

  // Style helper for header rows
  const applyHeaderStyle = (row, bgColor = 'FF4F46E5') => {
    row.height = 26;
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF3730A3' } },
        bottom: { style: 'medium', color: { argb: 'FF312E81' } },
        left: { style: 'thin', color: { argb: 'FF3730A3' } },
        right: { style: 'thin', color: { argb: 'FF3730A3' } }
      };
    });
  };

  // Style helper for data rows
  const applyRowStyle = (row, isEven = false) => {
    row.height = 20;
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

      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  };

  // ==========================================
  // SHEET 1: "Documents Overview"
  // ==========================================
  const overviewWs = wb.addWorksheet('Documents Overview', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const overviewColumns = [
    { header: 'Document Name', key: 'originalName', width: 32 },
    { header: 'Document Type', key: 'docType', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Pages', key: 'pageCount', width: 10 },
    { header: 'Uploaded Date', key: 'createdAt', width: 15 },
    { header: 'Reviewed Status', key: 'reviewedStatus', width: 16 }
  ];

  overviewWs.columns = overviewColumns;
  applyHeaderStyle(overviewWs.getRow(1), 'FF4F46E5'); // Indigo 600

  documents.forEach((doc, idx) => {
    const ext = extByDocId.get(doc._id.toString());
    const row = overviewWs.addRow({
      originalName: doc.originalName,
      docType: doc.docType || 'Other',
      status: (doc.status || 'queued').toUpperCase(),
      pageCount: doc.pageCount || 1,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : '',
      reviewedStatus: ext?.reviewedBy ? 'Verified' : 'Pending'
    });

    applyRowStyle(row, idx % 2 === 0);

    // Color code Status
    const statusCell = row.getCell(3);
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (doc.status === 'completed' || doc.status === 'reviewed') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF059669' } };
    } else if (doc.status === 'needs_review') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
    }
  });

  // ==========================================
  // GROUP BY TEMPLATE / DOCTYPE
  // ==========================================
  const docsByGroup = new Map();
  documents.forEach((doc) => {
    const groupKey = doc.docType && doc.docType !== 'Other' ? doc.docType : 'General Documents';
    if (!docsByGroup.has(groupKey)) {
      docsByGroup.set(groupKey, []);
    }
    docsByGroup.get(groupKey).push(doc);
  });

  // Collect table sheets to create
  const tableDataSheets = new Map(); // key: sheetName, value: { columns: Set, rows: Array }

  // Create a worksheet for each group
  docsByGroup.forEach((groupDocs, groupName) => {
    // Sanitize sheet name (Excel limits sheet names to 31 chars and disallows \ / ? * [ ])
    const safeSheetName = groupName.replace(/[\\/?*[\]]/g, '').slice(0, 31);
    const ws = wb.addWorksheet(safeSheetName, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Gather all scalar field keys for this group
    const fieldMap = new Map();
    groupDocs.forEach((doc) => {
      const ext = extByDocId.get(doc._id.toString());
      if (ext && Array.isArray(ext.fields)) {
        ext.fields.forEach((f) => {
          if (f.key && Array.isArray(f.value) && f.value.length > 0 && typeof f.value[0] === 'object') {
            // This is a nested TABLE field! Queue it for a separate table sheet
            const tableSheetName = `${f.label || f.key} - ${safeSheetName}`.replace(/[\\/?*[\]]/g, '').slice(0, 31);
            if (!tableDataSheets.has(tableSheetName)) {
              tableDataSheets.set(tableSheetName, {
                fieldKey: f.key,
                label: f.label || f.key,
                columns: new Set(['Document Name', 'Document ID']),
                rows: []
              });
            }
            const tableSheetInfo = tableDataSheets.get(tableSheetName);
            f.value.forEach((tableRow) => {
              Object.keys(tableRow).forEach((col) => tableSheetInfo.columns.add(col));
              tableSheetInfo.rows.push({
                'Document Name': doc.originalName,
                'Document ID': doc._id.toString(),
                ...tableRow
              });
            });
          } else if (!fieldMap.has(f.key)) {
            fieldMap.set(f.key, f.label || f.key.replace(/_/g, ' ').toUpperCase());
          }
        });
      }
    });

    // Build columns for this template worksheet
    const groupColumns = [
      { header: 'Document Name', key: 'originalName', width: 28 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Date Processed', key: 'createdAt', width: 16 }
    ];

    fieldMap.forEach((label, key) => {
      groupColumns.push({
        header: label,
        key: key,
        width: Math.max(16, label.length + 4)
      });
    });

    ws.columns = groupColumns;
    applyHeaderStyle(ws.getRow(1), 'FF2563EB'); // Blue 600

    groupDocs.forEach((doc, idx) => {
      const ext = extByDocId.get(doc._id.toString());
      const rowData = {
        originalName: doc.originalName,
        status: (doc.status || '').toUpperCase(),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : ''
      };

      if (ext && Array.isArray(ext.fields)) {
        ext.fields.forEach((f) => {
          if (f.value !== null && f.value !== undefined && !Array.isArray(f.value)) {
            rowData[f.key] = f.value;
          } else if (Array.isArray(f.value) && (f.value.length === 0 || typeof f.value[0] !== 'object')) {
            rowData[f.key] = f.value.join(', ');
          }
        });
      }

      const row = ws.addRow(rowData);
      applyRowStyle(row, idx % 2 === 0);
    });
  });

  // ==========================================
  // SHEET(S): Separate Worksheets for Table Fields
  // ==========================================
  tableDataSheets.forEach((tableInfo, sheetName) => {
    const tableWs = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const colList = Array.from(tableInfo.columns);
    tableWs.columns = colList.map((colName) => ({
      header: colName.replace(/_/g, ' ').toUpperCase(),
      key: colName,
      width: Math.max(16, colName.length + 5)
    }));

    applyHeaderStyle(tableWs.getRow(1), 'FF0D9488'); // Teal 600

    tableInfo.rows.forEach((rowObj, idx) => {
      const row = tableWs.addRow(rowObj);
      applyRowStyle(row, idx % 2 === 0);
    });
  });

  return wb;
}

/**
 * Generate a flat RFC-4180 compliant CSV string of document extractions
 * @param {Array<Object>} documents
 * @param {Array<Object>} extractions
 * @param {string} [templateId] - Optional template filter
 * @returns {string} CSV text
 */
function generateCsvData(documents, extractions, templateId = null) {
  const extByDocId = new Map();
  for (const ext of extractions || []) {
    extByDocId.set(ext.documentId.toString(), ext);
  }

  // Filter documents by templateId if provided
  const targetDocs = templateId
    ? documents.filter((d) => d.templateId && d.templateId.toString() === templateId.toString())
    : documents;

  // Collect all unique scalar field keys
  const fieldKeyMap = new Map();
  targetDocs.forEach((doc) => {
    const ext = extByDocId.get(doc._id.toString());
    if (ext && Array.isArray(ext.fields)) {
      ext.fields.forEach((f) => {
        if (!Array.isArray(f.value) && !fieldKeyMap.has(f.key)) {
          fieldKeyMap.set(f.key, f.label || f.key);
        }
      });
    }
  });

  // Headers
  const baseHeaders = ['Document Name', 'Document Type', 'Status', 'Uploaded Date'];
  const fieldKeys = Array.from(fieldKeyMap.keys());
  const fieldLabels = Array.from(fieldKeyMap.values());
  const allHeaders = [...baseHeaders, ...fieldLabels];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [];
  csvRows.push(allHeaders.map(escapeCsv).join(','));

  targetDocs.forEach((doc) => {
    const ext = extByDocId.get(doc._id.toString());
    const row = [
      doc.originalName,
      doc.docType || 'Other',
      (doc.status || '').toUpperCase(),
      doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : ''
    ];

    const fieldsObj = {};
    if (ext && Array.isArray(ext.fields)) {
      ext.fields.forEach((f) => {
        fieldsObj[f.key] = f.value;
      });
    }

    fieldKeys.forEach((key) => {
      row.push(fieldsObj[key] !== undefined && fieldsObj[key] !== null ? fieldsObj[key] : '');
    });

    csvRows.push(row.map(escapeCsv).join(','));
  });

  return csvRows.join('\r\n');
}

module.exports = {
  generateExcelWorkbook,
  generateCsvData
};
