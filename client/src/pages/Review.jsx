import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Save,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Edit3,
  Search,
  Eye
} from 'lucide-react';

const Review = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doc, setDoc] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [fields, setFields] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active highlighted field for source snippet localization
  const [activeFieldKey, setActiveFieldKey] = useState(null);

  // Action states
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const fetchDocumentData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/documents/${id}/extraction`);
      setDoc(data.document);
      setExtraction(data.extraction);
      setFields(data.extraction.fields || []);
      setValidationIssues(data.extraction.validationIssues || []);
      if (data.extraction.fields?.length > 0) {
        setActiveFieldKey(data.extraction.fields[0].key);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load extraction data for review.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
  }, [id]);

  const handleFieldValueChange = (key, newValue) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: newValue, edited: true } : f))
    );
  };

  const handleSaveCorrections = async () => {
    setSaving(true);
    setStatusMessage({ type: '', text: '' });
    try {
      const payload = {
        fields: fields.map((f) => ({ key: f.key, value: f.value }))
      };
      const { data } = await api.put(`/documents/${id}/extraction`, payload);
      setExtraction(data.extraction);
      setFields(data.extraction.fields);
      setValidationIssues(data.extraction.validationIssues);
      setStatusMessage({ type: 'success', text: 'Corrections saved and re-validated!' });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save corrections'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setStatusMessage({ type: '', text: '' });
    try {
      const { data } = await api.post(`/documents/${id}/approve`);
      setDoc(data.document);
      setExtraction(data.extraction);
      setStatusMessage({
        type: 'success',
        text: 'Document approved and marked as Reviewed!'
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve document'
      });
    } finally {
      setApproving(false);
    }
  };

  const activeField = fields.find((f) => f.key === activeFieldKey);
  const canReview = user?.role === 'admin' || user?.role === 'reviewer';

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Loading document & extraction review...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-4">
          {error || 'Document not found'}
        </div>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Link>
      </div>
    );
  }

  const token = localStorage.getItem('documind_token') || '';
  const fileUrl = `/api/documents/${doc._id}/file?token=${encodeURIComponent(token)}`;
  const isImage = doc.mimeType?.startsWith('image/');

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/library"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-lg truncate max-w-md">
                {doc.originalName}
              </h1>
              <StatusBadge status={doc.status} />
            </div>
            <p className="text-xs text-slate-400">
              Template: <span className="font-semibold text-slate-700">{extraction?.templateId?.name || 'General'}</span> • {doc.pageCount} page(s)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canReview && (
            <>
              <button
                onClick={handleSaveCorrections}
                disabled={saving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={handleApprove}
                disabled={approving || doc.status === 'reviewed'}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {doc.status === 'reviewed' ? 'Approved' : 'Approve Document'}
              </button>
            </>
          )}

          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Open original file in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage.text && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Split Review View (Left: Original Document | Right: Editable Extracted Fields) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[75vh]">
        {/* LEFT COLUMN: Original Document & Context Snippet */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[550px]">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-slate-400" /> Original Document Preview
              </span>
              <span>{doc.mimeType}</span>
            </div>

            <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-2">
              {isImage ? (
                <img
                  src={fileUrl}
                  alt={doc.originalName}
                  className="max-h-full max-w-full object-contain rounded shadow-sm"
                />
              ) : (
                <iframe
                  src={`${fileUrl}#toolbar=0`}
                  title={doc.originalName}
                  className="w-full h-full min-h-[550px] border-none rounded"
                />
              )}
            </div>
          </div>

          {/* Source Snippet Box */}
          {activeField && (
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 text-xs shadow-xs">
              <div className="flex items-center justify-between font-semibold text-indigo-900 mb-2">
                <span className="flex items-center gap-1.5">
                  <Search className="h-4 w-4 text-indigo-600" />
                  Source Evidence for <span className="font-bold text-indigo-950 capitalize">{activeField.key.replace(/_/g, ' ')}</span>
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 font-medium">
                  Page {activeField.sourcePage || 1}
                </span>
              </div>

              {activeField.sourceText ? (
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs text-slate-800 text-xs leading-relaxed">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-sans font-semibold">
                    Document Text Excerpt:
                  </div>
                  <span className="text-slate-800 bg-amber-50/70 px-2 py-1 rounded border border-amber-200/60 inline-block font-sans text-xs">
                    "{activeField.sourceText}"
                  </span>
                </div>
              ) : (
                <div className="bg-white/80 p-3 rounded-lg border border-slate-200 text-slate-500 italic text-xs">
                  Field was not detected in document text.
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Extracted Fields & Confidence */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Validation Issues Alert */}
          {validationIssues.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-center gap-2 font-bold text-rose-800 text-xs mb-2">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Validation Issues Flagged ({validationIssues.length})</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-700">
                {validationIssues.map((issue, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fields Box */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4 flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Extracted Fields</h3>
                <p className="text-xs text-slate-400">
                  Fields below 70% confidence are flagged for human review.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">
                {fields.length} Fields
              </span>
            </div>

            <div className="space-y-4">
              {fields.map((f) => {
                const isAbsent = f.value === null || f.value === undefined || f.value === '';
                const isLowConfidence = f.confidence < 0.7 && !isAbsent;
                const isActive = f.key === activeFieldKey;

                return (
                  <div
                    key={f.key}
                    onClick={() => setActiveFieldKey(f.key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-100'
                        : isLowConfidence
                        ? 'border-amber-300 bg-amber-50/30'
                        : isAbsent
                        ? 'border-slate-200 bg-slate-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800 capitalize">
                          {f.key.replace(/_/g, ' ')}
                        </span>
                        {f.edited && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100 flex items-center gap-0.5">
                            <Edit3 className="h-2.5 w-2.5" /> Edited
                          </span>
                        )}
                      </div>

                      {/* Confidence Meter Badge */}
                      {isAbsent ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                          Not Detected
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isLowConfidence
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {Math.round(f.confidence * 100)}% Confidence
                        </span>
                      )}
                    </div>

                    {/* Field Value Input */}
                    <input
                      type="text"
                      disabled={!canReview}
                      value={f.value !== null && f.value !== undefined ? f.value : ''}
                      onChange={(e) => handleFieldValueChange(f.key, e.target.value)}
                      placeholder="<Not Detected>"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;

