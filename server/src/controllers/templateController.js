const { Template, Document } = require('../models');
const { builtInTemplates } = require('../seed/templates');
const { extractWithLlama } = require('../services/llm');
const { validateRules } = require('../services/validate');

/**
 * @desc    Create a new extraction template
 * @route   POST /api/templates
 * @access  Private (Admin only)
 */
const createTemplate = async (req, res, next) => {
  try {
    const { name, description, keywords, fields, rules } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Template name is required' });
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ message: 'At least one field is required' });
    }

    const trimmedName = name.trim();
    const existing = await Template.findOne({
      orgId: req.user.orgId,
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ message: 'A template with this name already exists in your organization' });
    }

    const template = await Template.create({
      orgId: req.user.orgId,
      name: trimmedName,
      description: description ? description.trim() : '',
      keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).trim()).filter(Boolean) : [],
      fields,
      rules: Array.isArray(rules) ? rules : [],
      isBuiltIn: false,
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
 * @desc    Get all templates for the tenant (seeds built-ins if empty)
 * @route   GET /api/templates
 * @access  Private (All roles)
 */
const getTemplates = async (req, res, next) => {
  try {
    let templates = await Template.find({ orgId: req.user.orgId }).sort({ createdAt: 1 });

    // Ensure all 5 built-in templates exist for this organization
    for (const builtIn of builtInTemplates) {
      const exists = templates.find(
        (t) =>
          t.name.toLowerCase() === builtIn.name.toLowerCase() ||
          (builtIn.name === 'Contract or Agreement' && t.name.toLowerCase() === 'agreement')
      );
      if (!exists) {
        const newTmpl = await Template.create({
          ...builtIn,
          orgId: req.user.orgId,
          createdBy: req.user.id
        });
        templates.push(newTmpl);
      }
    }

    // Compute documentCount for each template in this organization
    const docCounts = await Document.aggregate([
      { $match: { orgId: req.user.orgId, templateId: { $ne: null } } },
      { $group: { _id: '$templateId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    for (const item of docCounts) {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      }
    }

    const mappedTemplates = templates.map((t) => {
      const obj = t.toObject();
      return {
        ...obj,
        fieldsCount: Array.isArray(obj.fields) ? obj.fields.length : 0,
        rulesCount: Array.isArray(obj.rules) ? obj.rules.length : 0,
        documentCount: countMap[obj._id.toString()] || 0
      };
    });

    return res.status(200).json({ templates: mappedTemplates });
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

    const documentCount = await Document.countDocuments({
      orgId: req.user.orgId,
      templateId: template._id
    });

    const obj = template.toObject();
    return res.status(200).json({
      template: {
        ...obj,
        fieldsCount: Array.isArray(obj.fields) ? obj.fields.length : 0,
        rulesCount: Array.isArray(obj.rules) ? obj.rules.length : 0,
        documentCount
      }
    });
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
    const { name, description, keywords, fields, rules } = req.body;

    const template = await Template.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (name) {
      const trimmedName = name.trim();
      const duplicate = await Template.findOne({
        orgId: req.user.orgId,
        _id: { $ne: template._id },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
      });
      if (duplicate) {
        return res.status(400).json({ message: 'Another template with this name already exists' });
      }
      template.name = trimmedName;
    }

    if (typeof description === 'string') template.description = description.trim();
    if (Array.isArray(keywords)) {
      template.keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
    }
    if (fields && Array.isArray(fields)) {
      if (fields.length === 0) {
        return res.status(400).json({ message: 'At least one field is required' });
      }
      template.fields = fields;
    }
    if (rules && Array.isArray(rules)) template.rules = rules;

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
 * @desc    Delete a template (Blocked if in use by documents)
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

    // Check if any documents use this template
    const docCount = await Document.countDocuments({
      orgId: req.user.orgId,
      templateId: template._id
    });

    if (docCount > 0) {
      return res.status(409).json({
        message: 'Cannot delete template that is in use by documents. You can duplicate it instead.',
        documentCount: docCount
      });
    }

    await Template.deleteOne({ _id: template._id });

    return res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Duplicate an existing template
 * @route   POST /api/templates/:id/duplicate
 * @access  Private (Admin only)
 */
const duplicateTemplate = async (req, res, next) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    let copyName = `${template.name} (Copy)`;
    let counter = 2;
    while (await Template.exists({ orgId: req.user.orgId, name: copyName })) {
      copyName = `${template.name} (Copy ${counter++})`;
    }

    const duplicate = await Template.create({
      orgId: req.user.orgId,
      name: copyName,
      description: template.description || '',
      keywords: template.keywords || [],
      fields: template.fields || [],
      rules: template.rules || [],
      isBuiltIn: false,
      createdBy: req.user.id
    });

    return res.status(201).json({
      message: 'Template duplicated successfully',
      template: duplicate
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Test template extraction on pasted text without persisting anything
 * @route   POST /api/templates/test
 * @access  Private (All authenticated roles)
 */
const testTemplate = async (req, res, next) => {
  try {
    const { templateId, template: rawTemplate, text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Sample text is required for testing' });
    }

    let targetTemplate = null;

    if (templateId) {
      targetTemplate = await Template.findOne({
        _id: templateId,
        orgId: req.user.orgId
      });
      if (!targetTemplate) {
        return res.status(404).json({ message: 'Template not found' });
      }
    } else if (rawTemplate && rawTemplate.fields && Array.isArray(rawTemplate.fields)) {
      targetTemplate = rawTemplate;
    } else {
      return res.status(400).json({ message: 'A valid template definition or templateId is required' });
    }

    // Run extraction with Ollama / Fallback
    const extracted = await extractWithLlama(text.trim(), targetTemplate);

    // Run rules engine
    const validationIssues = await validateRules(extracted, targetTemplate.rules || [], {
      Document,
      orgId: req.user.orgId
    });

    const errorCount = validationIssues.filter((i) => i.severity === 'error').length;

    return res.status(200).json({
      extracted,
      validationIssues,
      valid: errorCount === 0
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  testTemplate
};
