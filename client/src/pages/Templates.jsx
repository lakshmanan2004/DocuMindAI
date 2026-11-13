import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  FileCode,
  Info
} from 'lucide-react';

const Templates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New template form state
  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState([
    { key: '', label: '', type: 'string', required: false, hint: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/templates');
      setTemplates(data.templates);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      { key: '', label: '', type: 'string', required: false, hint: '' }
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
      // Auto-generate key from label if key is empty
      if (prop === 'label' && !updated[index].customKey) {
        updated[index].key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!templateName.trim()) {
      setFormError('Please enter a template name');
      return;
    }

    const invalidField = fields.find((f) => !f.key.trim() || !f.label.trim());
    if (invalidField) {
      setFormError('All fields must have both a Key and a Label');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/templates', {
        name: templateName.trim(),
        fields
      });
      setTemplates((prev) => [...prev, data.template]);
      setShowModal(false);
      setTemplateName('');
      setFields([{ key: '', label: '', type: 'string', required: false, hint: '' }]);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"? Documents using this template will retain their past extractions.`)) {
      return;
    }

    try {
      await api.delete(`/templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Extraction Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define target fields for Llama AI extraction (Invoices, Agreements, Forms, Reports).
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm">Loading extraction schemas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{tpl.name}</h3>
                      <p className="text-xs text-slate-400">
                        {tpl.fields.length} extraction fields defined
                      </p>
                    </div>
                  </div>

                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(tpl._id, tpl.name)}
                      title="Delete Template"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  {tpl.fields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200/60"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{f.label}</span>
                        <code className="text-[11px] text-slate-400">({f.key})</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-mono uppercase">
                          {f.type}
                        </span>
                        {f.required && (
                          <span className="text-[10px] font-bold text-amber-600">
                            Required
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Create Extraction Template</h3>
                <p className="text-xs text-slate-500">
                  Define the fields Llama will extract into verified structured JSON.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. GST Tax Invoice or Employment Contract"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Fields to Extract
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
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Field Label (e.g. Invoice Number)"
                            value={field.label}
                            onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-36">
                          <input
                            type="text"
                            required
                            placeholder="Key (e.g. invoice_num)"
                            value={field.key}
                            onChange={(e) => {
                              handleFieldChange(idx, 'customKey', true);
                              handleFieldChange(idx, 'key', e.target.value);
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-28">
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
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
                          placeholder="Extraction hint (e.g. Supplier 15-character GSTIN)"
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
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Save Template'}
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

