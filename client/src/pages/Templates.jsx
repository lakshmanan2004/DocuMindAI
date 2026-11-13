import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  Play,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  FileCode,
  Table as TableIcon,
  List as ListIcon,
  ShieldCheck,
  Tag,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const RULE_TYPES = [
  { value: 'required', label: 'Field Required' },
  { value: 'regex', label: 'Regex Pattern' },
  { value: 'number_range', label: 'Number Range' },
  { value: 'date_order', label: 'Date Ordering (Before < After)' },
  { value: 'table_sum_equals', label: 'Table Column Sum Equals Target' },
  { value: 'sum_of_fields_equals', label: 'Sum of Fields Equals Target' },
  { value: 'unique_in_org', label: 'Unique in Organization' }
];

const FIELD_TYPES = [
  { value: 'string', label: 'String / Text' },
  { value: 'number', label: 'Number / Amount' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean (Yes/No)' },
  { value: 'list', label: 'List of Items' },
  { value: 'table', label: 'Table (Multi-column)' }
];

const Templates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Builder Modal State
  const [showBuilder, setShowBuilder] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');
  const [fields, setFields] = useState([
    { key: '', label: '', type: 'string', required: false, hint: '', columns: [] }
  ]);
  const [rules, setRules] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Test Sandbox State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testTemplate, setTestTemplate] = useState(null);
  const [sampleText, setSampleText] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // --- Field Management ---
  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      { key: '', label: '', type: 'string', required: false, hint: '', columns: [] }
    ]);
  };

  const handleRemoveField = (index) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index, prop, value) => {
    setFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [prop]: value };

      if (prop === 'label' && !updated[index].customKey) {
        updated[index].key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      if (prop === 'type' && value === 'table' && (!updated[index].columns || updated[index].columns.length === 0)) {
        updated[index].columns = [
          { key: 'item', label: 'Item Description', type: 'string' },
          { key: 'amount', label: 'Amount', type: 'number' }
        ];
      }
      return updated;
    });
  };

  // Sub-columns for Table fields
  const handleAddSubColumn = (fieldIndex) => {
    setFields((prev) => {
      const updated = [...prev];
      const cols = updated[fieldIndex].columns || [];
      updated[fieldIndex].columns = [...cols, { key: '', label: '', type: 'string' }];
      return updated;
    });
  };

  const handleSubColumnChange = (fieldIndex, colIndex, prop, value) => {
    setFields((prev) => {
      const updated = [...prev];
      const cols = [...(updated[fieldIndex].columns || [])];
      cols[colIndex] = { ...cols[colIndex], [prop]: value };
      if (prop === 'label' && !cols[colIndex].customKey) {
        cols[colIndex].key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }
      updated[fieldIndex].columns = cols;
      return updated;
    });
  };

  const handleRemoveSubColumn = (fieldIndex, colIndex) => {
    setFields((prev) => {
      const updated = [...prev];
      updated[fieldIndex].columns = updated[fieldIndex].columns.filter((_, i) => i !== colIndex);
      return updated;
    });
  };

  // --- Rule Management ---
  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        type: 'required',
        field: fields[0]?.key || '',
        message: 'This field is required',
        severity: 'error'
      }
    ]);
  };

  const handleRuleChange = (index, prop, value) => {
    setRules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [prop]: value };
      return updated;
    });
  };

  const handleRemoveRule = (index) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Form Submission ---
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!templateName.trim()) {
      setFormError('Please enter a template name');
      return;
    }

    const invalidField = fields.find((f) => !f.key.trim() || !f.label.trim());
    if (invalidField) {
      setFormError('All fields must have both a key and a label');
      return;
    }

    setSubmitting(true);
    try {
      const keywords = keywordsStr
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload = {
        name: templateName.trim(),
        description: templateDesc.trim(),
        keywords,
        fields,
        rules
      };

      const { data } = await api.post('/templates', payload);
      setSuccessMsg(`Template "${data.template.name}" created successfully`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowBuilder(false);
      resetBuilder();
      fetchTemplates();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBuilder = () => {
    setTemplateName('');
    setTemplateDesc('');
    setKeywordsStr('');
    setFields([{ key: '', label: '', type: 'string', required: false, hint: '', columns: [] }]);
    setRules([]);
    setFormError('');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;

    try {
      await api.delete(`/templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
      setSuccessMsg(`Template "${name}" deleted successfully`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete template';
      alert(msg);
    }
  };

  const handleDuplicate = async (id, name) => {
    try {
      const { data } = await api.post(`/templates/${id}/duplicate`);
      setTemplates((prev) => [...prev, data.template]);
      setSuccessMsg(`Duplicated "${name}" to "${data.template.name}"`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to duplicate template');
    }
  };

  // --- Test Sandbox ---
  const openTestBox = (template) => {
    setTestTemplate(template);
    setSampleText('');
    setTestResult(null);
    setTestError('');
    setShowTestModal(true);
  };

  const handleRunTest = async () => {
    if (!sampleText.trim()) {
      setTestError('Please paste some sample document text to test extraction');
      return;
    }

    setTesting(true);
    setTestError('');
    setTestResult(null);

    try {
      const payload = {
        templateId: testTemplate._id,
        text: sampleText.trim()
      };
      const { data } = await api.post('/templates/test', payload);
      setTestResult(data);
    } catch (err) {
      setTestError(err.response?.data?.message || 'Extraction test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Extraction Templates & Schemas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build and test document schemas. Core engine is document-type agnostic with validation rules.
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => {
              resetBuilder();
              setShowBuilder(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Build Template
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm">Loading schemas and rules...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {tpl.name}
                        {tpl.isBuiltIn && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                            Built-in
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {tpl.description || 'No description provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Counts / Stats */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      {tpl.fieldsCount ?? tpl.fields?.length ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fields</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      {tpl.rulesCount ?? tpl.rules?.length ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Rules</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-indigo-600">
                      {tpl.documentCount ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Docs</span>
                  </div>
                </div>

                {/* Keywords Chips */}
                {tpl.keywords && tpl.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tpl.keywords.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-indigo-50/60 text-indigo-700 text-[10px] font-medium"
                      >
                        {kw}
                      </span>
                    ))}
                    {tpl.keywords.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{tpl.keywords.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Fields Preview List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto">
                  {tpl.fields?.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50/70 border border-slate-200/50"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {f.type === 'table' ? (
                          <TableIcon className="h-3 w-3 text-indigo-500 shrink-0" />
                        ) : f.type === 'list' ? (
                          <ListIcon className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                          <FileCode className="h-3 w-3 text-slate-400 shrink-0" />
                        )}
                        <span className="font-medium text-slate-700 truncate">{f.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-500 text-[9px] font-mono uppercase">
                          {f.type}
                        </span>
                        {f.required && (
                          <span className="text-[9px] font-bold text-amber-600">*</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-slate-100">
                <button
                  onClick={() => openTestBox(tpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current" />
                  Test Sandbox
                </button>

                <div className="flex items-center gap-1">
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => handleDuplicate(tpl._id, tpl.name)}
                        title="Duplicate template"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tpl._id, tpl.name)}
                        title={
                          tpl.documentCount > 0
                            ? 'Cannot delete: in use by documents'
                            : 'Delete template'
                        }
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          tpl.documentCount > 0
                            ? 'text-slate-300 hover:text-slate-400'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Sandbox Drawer / Modal */}
      {showTestModal && testTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Play className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    Test Box: {testTemplate.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paste raw text to test field extraction and rules validation without persisting anything.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {testError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Paste Sample Document Text
                </label>
                <textarea
                  rows={6}
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder="Paste invoice text, marksheet transcript, lab report or contract clauses..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {testTemplate.fields?.length || 0} fields &bull; {testTemplate.rules?.length || 0} validation rules
                </span>
                <button
                  onClick={handleRunTest}
                  disabled={testing || !sampleText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Run Test Extraction
                    </>
                  )}
                </button>
              </div>

              {/* Results View */}
              {testResult && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Extraction Results & Validation
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        testResult.valid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {testResult.valid ? 'Passed All Rules' : 'Validation Issues Detected'}
                    </span>
                  </div>

                  {/* Validation issues list */}
                  {testResult.validationIssues && testResult.validationIssues.length > 0 && (
                    <div className="space-y-2">
                      {testResult.validationIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 ${
                            issue.severity === 'error'
                              ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                              : 'bg-amber-50/70 border-amber-200 text-amber-800'
                          }`}
                        >
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          )}
                          <div className="flex-1">
                            <span className="font-semibold uppercase text-[10px] mr-1.5 px-1 rounded bg-white/70">
                              {issue.rule}
                            </span>
                            <span>{issue.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* JSON Preview */}
                  <div>
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Extracted JSON Data:
                    </span>
                    <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-60">
                      {JSON.stringify(testResult.extracted, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl"
              >
                Close Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Build Custom Template</h3>
                <p className="text-xs text-slate-500">
                  Define fields (scalars, lists, tables) and generic validation rules.
                </p>
              </div>
              <button
                onClick={() => setShowBuilder(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTemplate} className="p-6 overflow-y-auto space-y-6 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* General Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Purchase Order, Blood Test Report, Lease Agreement"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="Brief description of documents matching this template"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Keywords (comma-separated for auto-classification)
                  </label>
                  <input
                    type="text"
                    value={keywordsStr}
                    onChange={(e) => setKeywordsStr(e.target.value)}
                    placeholder="po number, delivery date, vendor, purchase order"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Fields Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                    Fields to Extract ({fields.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Field Label (e.g. Total Amount)"
                            value={field.label}
                            onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-36">
                          <input
                            type="text"
                            required
                            placeholder="Key (e.g. total_amount)"
                            value={field.key}
                            onChange={(e) => {
                              handleFieldChange(idx, 'customKey', true);
                              handleFieldChange(idx, 'key', e.target.value);
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          disabled={fields.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          placeholder="Extraction hint (e.g. Grand total in INR or currency)"
                          value={field.hint}
                          onChange={(e) => handleFieldChange(idx, 'hint', e.target.value)}
                          className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 outline-none"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>Required</span>
                        </label>
                      </div>

                      {/* Sub-columns Builder for Table Field */}
                      {field.type === 'table' && (
                        <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700">
                              Table Sub-Columns ({field.columns?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddSubColumn(idx)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                            >
                              + Add Column
                            </button>
                          </div>

                          {field.columns?.map((col, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Col Label (e.g. Rate)"
                                value={col.label}
                                onChange={(e) =>
                                  handleSubColumnChange(idx, cIdx, 'label', e.target.value)
                                }
                                className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Col Key (e.g. rate)"
                                value={col.key}
                                onChange={(e) => {
                                  handleSubColumnChange(idx, cIdx, 'customKey', true);
                                  handleSubColumnChange(idx, cIdx, 'key', e.target.value);
                                }}
                                className="w-28 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                              />
                              <select
                                value={col.type}
                                onChange={(e) =>
                                  handleSubColumnChange(idx, cIdx, 'type', e.target.value)
                                }
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubColumn(idx, cIdx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Rules Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                    Validation Rules ({rules.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Rule
                  </button>
                </div>

                {rules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No validation rules added yet. Add rules like sum checks, regex checks, or date ordering.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={rule.type}
                            onChange={(e) => handleRuleChange(rIdx, 'type', e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                          >
                            {RULE_TYPES.map((rt) => (
                              <option key={rt.value} value={rt.value}>
                                {rt.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={rule.severity || 'error'}
                            onChange={(e) => handleRuleChange(rIdx, 'severity', e.target.value)}
                            className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          >
                            <option value="error">Error (Red)</option>
                            <option value="warning">Warning (Amber)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rIdx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Rule Parameters depending on type */}
                        {rule.type === 'required' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 w-20">Field Key:</span>
                            <input
                              type="text"
                              placeholder="e.g. invoice_number"
                              value={rule.field || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'field', e.target.value)}
                              className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                          </div>
                        )}

                        {rule.type === 'regex' && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Field key (e.g. gstin)"
                              value={rule.field || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'field', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Regex pattern (e.g. ^\d{2}[A-Z]{5}...$)"
                              value={rule.pattern || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'pattern', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                          </div>
                        )}

                        {rule.type === 'number_range' && (
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Field key"
                              value={rule.field || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'field', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="number"
                              placeholder="Min value"
                              value={rule.min ?? ''}
                              onChange={(e) => handleRuleChange(rIdx, 'min', parseFloat(e.target.value))}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                            <input
                              type="number"
                              placeholder="Max value"
                              value={rule.max ?? ''}
                              onChange={(e) => handleRuleChange(rIdx, 'max', parseFloat(e.target.value))}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </div>
                        )}

                        {rule.type === 'date_order' && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Before Date Key (e.g. start_date)"
                              value={rule.before || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'before', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="After Date Key (e.g. end_date)"
                              value={rule.after || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'after', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                          </div>
                        )}

                        {rule.type === 'table_sum_equals' && (
                          <div className="grid grid-cols-4 gap-2">
                            <input
                              type="text"
                              placeholder="Table (e.g. items)"
                              value={rule.table || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'table', e.target.value)}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Col (e.g. amount)"
                              value={rule.column || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'column', e.target.value)}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Target (e.g. total)"
                              value={rule.target || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'target', e.target.value)}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="number"
                              placeholder="Tolerance (e.g. 1)"
                              value={rule.tolerance ?? 0}
                              onChange={(e) =>
                                handleRuleChange(rIdx, 'tolerance', parseFloat(e.target.value) || 0)
                              }
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </div>
                        )}

                        {rule.type === 'sum_of_fields_equals' && (
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Fields comma-separated"
                              value={Array.isArray(rule.fields) ? rule.fields.join(', ') : rule.fields || ''}
                              onChange={(e) =>
                                handleRuleChange(
                                  rIdx,
                                  'fields',
                                  e.target.value.split(',').map((f) => f.trim()).filter(Boolean)
                                )
                              }
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Target field key"
                              value={rule.target || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'target', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                            />
                            <input
                              type="number"
                              placeholder="Tolerance"
                              value={rule.tolerance ?? 0}
                              onChange={(e) =>
                                handleRuleChange(rIdx, 'tolerance', parseFloat(e.target.value) || 0)
                              }
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </div>
                        )}

                        {rule.type === 'unique_in_org' && (
                          <input
                            type="text"
                            placeholder="Fields comma-separated (e.g. invoice_number, gstin)"
                            value={Array.isArray(rule.fields) ? rule.fields.join(', ') : rule.fields || ''}
                            onChange={(e) =>
                              handleRuleChange(
                                rIdx,
                                'fields',
                                e.target.value.split(',').map((f) => f.trim()).filter(Boolean)
                              )
                            }
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                          />
                        )}

                        <input
                          type="text"
                          required
                          placeholder="Error / Warning message when rule fails"
                          value={rule.message || ''}
                          onChange={(e) => handleRuleChange(rIdx, 'message', e.target.value)}
                          className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating Template...' : 'Save & Publish Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
