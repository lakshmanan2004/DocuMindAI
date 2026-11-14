const { Document, Extraction, Template, User } = require('../models');
const { generateExcelWorkbook, generateCsvData } = require('../services/excel');
const { recordAudit } = require('../services/audit');

/**
 * Export extracted document records to Excel (.xlsx)
 * POST /api/export/excel
 */
const exportToExcel = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { documentIds } = req.body;

    const query = { orgId };

    if (Array.isArray(documentIds) && documentIds.length > 0) {
      query._id = { $in: documentIds };
    } else {
      // By default export processed documents
      query.status = { $in: ['completed', 'needs_review', 'reviewed'] };
    }

    const documents = await Document.find(query).sort({ createdAt: -1 });

    if (!documents || documents.length === 0) {
      return res.status(404).json({ message: 'No documents found matching export criteria' });
    }

    const docIds = documents.map((d) => d._id);
    const extractions = await Extraction.find({ documentId: { $in: docIds } });
    const templates = await Template.find({ orgId });

    // Generate Excel workbook
    const workbook = await generateExcelWorkbook(documents, extractions, templates);

    // Fetch user details for audit logging
    const user = await User.findById(req.user.id).select('name role');

    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: user?.name || 'User',
      userRole: req.user.role,
      action: 'export',
      details: {
        documentCount: documents.length,
        exportedIds: docIds.slice(0, 10)
      }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `DocuMind_Export_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[Export Controller Error]', error);
    res.status(500).json({ message: error.message || 'Failed to export documents to Excel' });
  }
};

/**
 * Export extracted document records to CSV (.csv)
 * POST /api/export/csv
 */
const exportToCsv = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const documentIds = req.body?.documentIds || (req.query?.documentIds ? req.query.documentIds.split(',') : null);
    const templateId = req.body?.templateId || req.query?.templateId || null;

    const query = { orgId };

    if (Array.isArray(documentIds) && documentIds.length > 0) {
      query._id = { $in: documentIds };
    } else {
      query.status = { $in: ['completed', 'needs_review', 'reviewed'] };
    }

    if (templateId) {
      query.templateId = templateId;
    }

    const documents = await Document.find(query).sort({ createdAt: -1 });

    if (!documents || documents.length === 0) {
      return res.status(404).json({ message: 'No documents found matching export criteria' });
    }

    const docIds = documents.map((d) => d._id);
    const extractions = await Extraction.find({ documentId: { $in: docIds } });

    const csvContent = generateCsvData(documents, extractions, templateId);

    const user = await User.findById(req.user.id).select('name role');

    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: user?.name || 'User',
      userRole: req.user.role,
      action: 'export_csv',
      details: {
        documentCount: documents.length,
        templateId
      }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `DocuMind_Export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export CSV Controller Error]', error);
    res.status(500).json({ message: error.message || 'Failed to export documents to CSV' });
  }
};

module.exports = {
  exportToExcel,
  exportToCsv
};

