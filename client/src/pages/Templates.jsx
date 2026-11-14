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
import { Button, Card, StatusBadge } from '../ui';

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
          <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#007AFF]" />
            Extraction Templates & Schemas
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Build and test document schemas. Core engine is document-type agnostic with validation rules.
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => {
              resetBuilder();
              setShowBuilder(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#007AFF] hover:opacity-90 text-white text-xs sm:text-sm font-semibold rounded-[12px] shadow-xs active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Build Template
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-[14px] bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-sm flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[14px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#8E8E93]">
          <RefreshCw className="h-7 w-7 animate-spin text-[#007AFF] mb-3" />
          <p className="text-sm">Loading schemas and rules...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.05] dark:border-white/[0.08] shadow-xs p-5 flex flex-col justify-between hover:border-black/[0.1] dark:hover:border-white/[0.15] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-[12px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm flex items-center gap-2">
                        {tpl.name}
                        {tpl.isBuiltIn && (
                          <span className="px-1.5 py-0.5 rounded-[6px] bg-black/[0.04] dark:bg-white/[0.06] text-[#8E8E93] text-[10px] font-medium border border-black/[0.04] dark:border-white/[0.06]">
                            Built-in
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[#6B7280] line-clamp-1">
                        {tpl.description || 'No description provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Counts / Stats */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[12px] border border-black/[0.04] dark:border-white/[0.06] text-center">
                  <div>
                    <span className="block text-xs font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">
                      {tpl.fieldsCount ?? tpl.fields?.length ?? 0}
                    </span>
                    <span className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Fields</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">
                      {tpl.rulesCount ?? tpl.rules?.length ?? 0}
                    </span>
                    <span className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Rules</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#007AFF]">
                      {tpl.documentCount ?? 0}
                    </span>
                    <span className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Docs</span>
                  </div>
                </div>

                {/* Keywords Chips */}
                {tpl.keywords && tpl.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tpl.keywords.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-[6px] bg-[#007AFF]/10 text-[#007AFF] text-[10px] font-medium"
                      >
                        {kw}
                      </span>
                    ))}
                    {tpl.keywords.length > 3 && (
                      <span className="text-[10px] text-[#8E8E93] self-center">
                        +{tpl.keywords.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Fields Preview List */}
                <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] max-h-36 overflow-y-auto">
                  {tpl.fields?.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-[8px] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.04] dark:border-white/[0.06]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {f.type === 'table' ? (
                          <TableIcon className="h-3 w-3 text-[#5856D6] shrink-0" />
                        ) : f.type === 'list' ? (
                          <ListIcon className="h-3 w-3 text-[#34C759] shrink-0" />
                        ) : (
                          <FileCode className="h-3 w-3 text-[#8E8E93] shrink-0" />
                        )}
                        <span className="font-medium text-[#1C1C1E] dark:text-[#F2F2F7] truncate">{f.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.2 rounded bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] text-[#8E8E93] text-[9px] font-mono uppercase">
                          {f.type}
                        </span>
                        {f.required && (
                          <span className="text-[9px] font-bold text-[#FF9500]">*</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  onClick={() => openTestBox(tpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] hover:bg-[#007AFF]/10 hover:text-[#007AFF] text-[#1C1C1E] dark:text-[#F2F2F7] rounded-[10px] text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current" />
                  Test Sandbox
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(tpl._id, tpl.name)}
                    title="Duplicate template"
                    className="p-1.5 text-[#8E8E93] hover:text-[#007AFF] rounded-[8px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors active:scale-[0.97] cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>

                  {!tpl.isBuiltIn && user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(tpl._id, tpl.name)}
                      title="Delete template"
                      className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] rounded-[8px] hover:bg-[#FF3B30]/10 transition-colors active:scale-[0.97] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Sandbox Drawer / Modal */}
      {showTestModal && testTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass bg-white/95 dark:bg-[#1C1C1E]/95 rounded-[24px] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-black/[0.08] dark:border-white/[0.1] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[12px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold">
                  <Play className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-base flex items-center gap-2">
                    Test Box: {testTemplate.name}
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Paste raw text to test field extraction and rules validation without persisting anything.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1.5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] rounded-[8px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-[0.97] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {testError && (
                <div className="p-3.5 rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5">
                  Paste Sample Document Text
                </label>
                <textarea
                  rows={6}
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder="Paste invoice text, marksheet transcript, lab report or contract clauses..."
                  className="w-full px-3.5 py-2.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-[12px] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#007AFF] text-[#1C1C1E] dark:text-[#F2F2F7]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8E8E93]">
                  {testTemplate.fields?.length || 0} fields &bull; {testTemplate.rules?.length || 0} validation rules
                </span>
                <button
                  onClick={handleRunTest}
                  disabled={testing || !sampleText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-[12px] shadow-xs active:scale-[0.97] transition-all cursor-pointer"
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
                <div className="space-y-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-xs uppercase tracking-wider">
                      Extraction Results & Validation
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        testResult.valid
                          ? 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                          : 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20'
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
                          className={`p-2.5 rounded-[10px] border text-xs flex items-center gap-2.5 ${
                            issue.severity === 'error'
                              ? 'bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]'
                              : 'bg-[#FF9500]/10 border-[#FF9500]/20 text-[#FF9500]'
                          }`}
                        >
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-[#FF3B30] shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-[#FF9500] shrink-0" />
                          )}
                          <div className="flex-1">
                            <span className="font-semibold uppercase text-[10px] mr-1.5 px-1 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                              {issue.rule}
                            </span>
                            <span>{issue.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extracted Fields Table */}
                  <div className="border border-black/[0.05] dark:border-white/[0.08] rounded-[14px] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F2F2F7] dark:bg-[#2C2C2E] border-b border-black/[0.05] dark:border-white/[0.08] text-[#8E8E93] font-semibold uppercase">
                        <tr>
                          <th className="px-3.5 py-2">Field Label</th>
                          <th className="px-3.5 py-2">Key</th>
                          <th className="px-3.5 py-2">Extracted Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                        {testResult.fields?.map((f, i) => (
                          <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                            <td className="px-3.5 py-2 font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">{f.label}</td>
                            <td className="px-3.5 py-2 font-mono text-[#8E8E93]">{f.key}</td>
                            <td className="px-3.5 py-2 text-[#1C1C1E] dark:text-[#F2F2F7]">
                              {typeof f.value === 'object' && f.value !== null ? (
                                <pre className="font-mono text-[10px] bg-black/[0.03] dark:bg-white/[0.06] p-1 rounded">
                                  {JSON.stringify(f.value, null, 2)}
                                </pre>
                              ) : (
                                String(f.value ?? '—')
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass bg-white/95 dark:bg-[#1C1C1E]/95 rounded-[24px] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-black/[0.08] dark:border-white/[0.1] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[12px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-base">Create Schema Template</h3>
                  <p className="text-xs text-[#6B7280]">
                    Define target fields, table columns, and cross-field validation rules for automated classification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="p-1.5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] rounded-[8px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-[0.97] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTemplate} className="p-6 overflow-y-auto space-y-6 flex-1">
              {formError && (
                <div className="p-3.5 rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Template Meta */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Purchase Order, Blood Test, Certificate"
                      className="w-full px-3.5 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-[10px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={templateDesc}
                      onChange={(e) => setTemplateDesc(e.target.value)}
                      placeholder="Brief note about target documents"
                      className="w-full px-3.5 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-[10px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1">
                    Auto-Classification Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={keywordsStr}
                    onChange={(e) => setKeywordsStr(e.target.value)}
                    placeholder="po number, delivery date, vendor, purchase order"
                    className="w-full px-3.5 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-[10px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
                  />
                </div>
              </div>

              {/* Fields Section */}
              <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7]">
                    Fields to Extract ({fields.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#007AFF] hover:opacity-80 active:scale-[0.97] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-[14px] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Field Label (e.g. Total Amount)"
                            value={field.label}
                            onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
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
                            className="w-full px-3 py-1.5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF] outline-none"
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value} className="dark:bg-[#1C1C1E]">
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          disabled={fields.length <= 1}
                          className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] disabled:opacity-30 cursor-pointer active:scale-[0.97]"
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
                          className="flex-1 px-3 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] outline-none"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-[#6B7280] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                            className="rounded text-[#007AFF]"
                          />
                          <span>Required</span>
                        </label>
                      </div>

                      {/* Sub-columns Builder for Table Field */}
                      {field.type === 'table' && (
                        <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-[10px] border border-black/[0.05] dark:border-white/[0.08] space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">
                              Table Sub-Columns ({field.columns?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddSubColumn(idx)}
                              className="text-[11px] text-[#007AFF] hover:opacity-80 font-bold active:scale-[0.97] cursor-pointer"
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
                                className="flex-1 px-2.5 py-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
                              />
                              <input
                                type="text"
                                placeholder="Col Key (e.g. rate)"
                                value={col.key}
                                onChange={(e) => {
                                  handleSubColumnChange(idx, cIdx, 'customKey', true);
                                  handleSubColumnChange(idx, cIdx, 'key', e.target.value);
                                }}
                                className="w-28 px-2.5 py-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                              />
                              <select
                                value={col.type}
                                onChange={(e) =>
                                  handleSubColumnChange(idx, cIdx, 'type', e.target.value)
                                }
                                className="w-24 px-2 py-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubColumn(idx, cIdx)}
                                className="text-[#8E8E93] hover:text-[#FF3B30] p-1 active:scale-[0.97] cursor-pointer"
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
              <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7]">
                    Validation Rules ({rules.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#007AFF] hover:opacity-80 active:scale-[0.97] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Rule
                  </button>
                </div>

                {rules.length === 0 ? (
                  <p className="text-xs text-[#8E8E93] italic">
                    No validation rules added yet. Add rules like sum checks, regex checks, or date ordering.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3.5 rounded-[14px] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={rule.type}
                            onChange={(e) => handleRuleChange(rIdx, 'type', e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
                          >
                            {RULE_TYPES.map((rt) => (
                              <option key={rt.value} value={rt.value} className="dark:bg-[#1C1C1E]">
                                {rt.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={rule.severity || 'error'}
                            onChange={(e) => handleRuleChange(rIdx, 'severity', e.target.value)}
                            className="w-28 px-2 py-1.5 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]"
                          >
                            <option value="error">Error (Red)</option>
                            <option value="warning">Warning (Amber)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rIdx)}
                            className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] cursor-pointer active:scale-[0.97]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Rule Parameters depending on type */}
                        {rule.type === 'required' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#8E8E93] w-20">Field Key:</span>
                            <input
                              type="text"
                              placeholder="e.g. invoice_number"
                              value={rule.field || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'field', e.target.value)}
                              className="flex-1 px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="text"
                              placeholder="Regex pattern (e.g. ^\d{2}[A-Z]{5}...$)"
                              value={rule.pattern || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'pattern', e.target.value)}
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="number"
                              placeholder="Min value"
                              value={rule.min ?? ''}
                              onChange={(e) => handleRuleChange(rIdx, 'min', parseFloat(e.target.value))}
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="number"
                              placeholder="Max value"
                              value={rule.max ?? ''}
                              onChange={(e) => handleRuleChange(rIdx, 'max', parseFloat(e.target.value))}
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="text"
                              placeholder="After Date Key (e.g. end_date)"
                              value={rule.after || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'after', e.target.value)}
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                              className="px-2 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="text"
                              placeholder="Col (e.g. amount)"
                              value={rule.column || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'column', e.target.value)}
                              className="px-2 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="text"
                              placeholder="Target (e.g. total)"
                              value={rule.target || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'target', e.target.value)}
                              className="px-2 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="number"
                              placeholder="Tolerance (e.g. 1)"
                              value={rule.tolerance ?? 0}
                              onChange={(e) =>
                                handleRuleChange(rIdx, 'tolerance', parseFloat(e.target.value) || 0)
                              }
                              className="px-2 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="text"
                              placeholder="Target field key"
                              value={rule.target || ''}
                              onChange={(e) => handleRuleChange(rIdx, 'target', e.target.value)}
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                            />
                            <input
                              type="number"
                              placeholder="Tolerance"
                              value={rule.tolerance ?? 0}
                              onChange={(e) =>
                                handleRuleChange(rIdx, 'tolerance', parseFloat(e.target.value) || 0)
                              }
                              className="px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs text-[#1C1C1E] dark:text-[#F2F2F7]"
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
                            className="w-full px-2.5 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7]"
                          />
                        )}

                        <input
                          type="text"
                          required
                          placeholder="Error / Warning message when rule fails"
                          value={rule.message || ''}
                          onChange={(e) => handleRuleChange(rIdx, 'message', e.target.value)}
                          className="w-full px-3 py-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[8px] text-xs text-[#1C1C1E] dark:text-[#F2F2F7] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-[10px] active:scale-[0.97] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#007AFF] hover:opacity-90 text-white text-xs font-semibold rounded-[10px] shadow-xs disabled:opacity-50 active:scale-[0.97] cursor-pointer"
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
