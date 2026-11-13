const { Template } = require('../models');

/**
 * Starter templates seeded if none exist in the organization
 */
const STARTER_TEMPLATES = [
  {
    name: 'Invoice',
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', type: 'string', required: true, hint: 'Invoice or Bill Number' },
      { key: 'gstin', label: 'Supplier GSTIN', type: 'string', required: false, hint: '15-character GST identification number' },
      { key: 'date', label: 'Invoice Date', type: 'date', required: false, hint: 'Date of invoice issue' },
      { key: 'total_amount', label: 'Total Amount', type: 'number', required: true, hint: 'Grand Total in currency' }
    ]
  },
  {
    name: 'Agreement',
    fields: [
      { key: 'party_one', label: 'First Party', type: 'string', required: true, hint: 'Name of the first contracting entity' },
      { key: 'party_two', label: 'Second Party', type: 'string', required: true, hint: 'Name of the second contracting entity' },
      { key: 'effective_date', label: 'Effective Date', type: 'date', required: false, hint: 'Agreement start date' },
      { key: 'governing_law', label: 'Governing Law', type: 'string', required: false, hint: 'Jurisdiction or governing law state' }
    ]
  }
];

/**
 * @desc    Create a new extraction template
 * @route   POST /api/templates
 * @access  Private (Admin only)
 */
const createTemplate = async (req, res, next) => {
  try {
    const { name, fields } = req.body;

    if (!name || !fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ message: 'Template name and at least one field are required' });
    }

    const template = await Template.create({
      orgId: req.user.orgId,
      name: name.trim(),
      fields,
      createdBy: req.user.id
    });

    return res.status(201).json({
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all templates for the tenant (seeds starter templates if empty)
 * @route   GET /api/templates
 * @access  Private (All roles)
 */
const getTemplates = async (req, res, next) => {
  try {
    let templates = await Template.find({ orgId: req.user.orgId }).sort({ createdAt: 1 });

    // Seed default starter templates (Invoice & Agreement) if none exist yet for this org
    if (templates.length === 0) {
      const seeded = STARTER_TEMPLATES.map((t) => ({
        ...t,
        orgId: req.user.orgId,
        createdBy: req.user.id
      }));
      templates = await Template.insertMany(seeded);
    }

    return res.status(200).json({ templates });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get template by ID
 * @route   GET /api/templates/:id
 * @access  Private (All roles)
 */
const getTemplateById = async (req, res, next) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    return res.status(200).json({ template });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a template
 * @route   PUT /api/templates/:id
 * @access  Private (Admin only)
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { name, fields } = req.body;

    const template = await Template.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (name) template.name = name.trim();
    if (fields && Array.isArray(fields)) template.fields = fields;

    await template.save();

    return res.status(200).json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a template
 * @route   DELETE /api/templates/:id
 * @access  Private (Admin only)
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    await Template.deleteOne({ _id: template._id });

    return res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate
};

