import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  Eye,
  BookOpen,
  MessageSquare,
  Sparkles,
  Layers
} from 'lucide-react';
import { Button, Card, StatusBadge, ConfidenceBar, SegmentedControl, Modal, Select } from '../ui';

const Review = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'text' | 'summary' | 'chat'

  const [doc, setDoc] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [fields, setFields] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [error, setError] = useState('');

  // Active highlighted field for source snippet localization
  const [activeFieldKey, setActiveFieldKey] = useState(null);

  // Action states
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Change Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedNewType, setSelectedNewType] = useState('');
  const [reprocessing, setReprocessing] = useState(false);

  const fetchDocumentData = async () => {
    setLoading(true);
    setError('');
    try {
      const [extRes, docRes] = await Promise.all([
        api.get(`/documents/${id}/extraction`).catch(() => ({ data: { extraction: null } })),
        api.get(`/documents/${id}`)
      ]);

      setDoc(docRes.data.document);
      if (extRes.data?.extraction) {
        setExtraction(extRes.data.extraction);
        setFields(extRes.data.extraction.fields || []);
        setValidationIssues(extRes.data.extraction.validationIssues || []);
        if (extRes.data.extraction.fields?.length > 0) {
          setActiveFieldKey(extRes.data.extraction.fields[0].key);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load document data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    setPagesLoading(true);
    try {
      const { data } = await api.get(`/documents/${id}/pages`);
      setPages(data.pages || []);
    } catch (err) {
      console.warn('Failed to fetch pages:', err.message);
    } finally {
      setPagesLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
    api.get('/templates').then((res) => setAvailableTemplates(res.data?.templates || [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (activeTab === 'text') {
      fetchPages();
    }
  }, [activeTab]);

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
      setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
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
      setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve document'
      });
    } finally {
      setApproving(false);
    }
  };

  const handleChangeType = async () => {
    if (!selectedNewType) return;
    setReprocessing(true);
    try {
      await api.post(`/documents/${id}/reprocess`, {
        templateId: selectedNewType
      });
      setShowTypeModal(false);
      navigate('/library');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change document type');
    } finally {
      setReprocessing(false);
    }
  };

  const activeField = fields.find((f) => f.key === activeFieldKey);
  const canReview = user?.role === 'admin' || user?.role === 'reviewer';

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#6B7280]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#007AFF] mb-3" />
        <p className="text-sm">Loading document & text extraction...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="p-4 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-sm mb-4">
          {error || 'Document not found'}
        </div>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-[#007AFF] font-semibold text-sm hover:underline"
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
      {/* Header with Type, Confidence, Status & Tabs */}
      <Card className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/library"
              className="p-2 text-[#6B7280] hover:text-[#1C1C1E] dark:hover:text-white rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-bold text-lg text-[#1C1C1E] dark:text-[#F2F2F7] truncate max-w-md">
                  {doc.originalName}
                </h1>
                <StatusBadge status={doc.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-1">
                <span>
                  Type: <span className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{doc.docType || extraction?.templateId?.name || 'Other'}</span>
                </span>
                <span>•</span>
                <span>{doc.pageCount || pages.length || 1} page(s)</span>
                {doc.classificationConfidence > 0 && (
                  <>
                    <span>•</span>
                    <span>Confidence: {Math.round(doc.classificationConfidence * 100)}%</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {canReview && (
              <Button
                variant="secondary"
                size="sm"
                icon={Layers}
                onClick={() => setShowTypeModal(true)}
              >
                Change Type
              </Button>
            )}

            {canReview && activeTab === 'review' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Save}
                  loading={saving}
                  onClick={handleSaveCorrections}
                >
                  Save
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  loading={approving}
                  disabled={doc.status === 'reviewed'}
                  onClick={handleApprove}
                >
                  {doc.status === 'reviewed' ? 'Approved' : 'Approve'}
                </Button>
              </>
            )}

            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-[#6B7280] hover:text-[#007AFF] hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors"
              title="Open original file in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs (Review, Text Pages, Summary, Chat) */}
        <div className="pt-2 border-t border-black/5 dark:border-white/10">
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { label: 'Review & Fields', value: 'review' },
              { label: `Text (${doc.pageCount || 1} Pages)`, value: 'text' },
              { label: 'AI Summary', value: 'summary' },
              { label: 'Chat with Doc', value: 'chat' }
            ]}
          />
        </div>
      </Card>

      {/* Notifications */}
      {statusMessage.text && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-[#34C759]/15 border-[#34C759]/30 text-[#34C759]'
              : 'bg-[#FF3B30]/15 border-[#FF3B30]/30 text-[#FF3B30]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: REVIEW (Viewer + Fields Dual Pane) */}
      {activeTab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[75vh]">
          {/* Left Column: Original Document */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <Card className="p-0 overflow-hidden flex-1 flex flex-col min-h-[550px]">
              <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/10 flex items-center justify-between text-xs text-[#6B7280]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Eye className="h-3.5 w-3.5 text-[#007AFF]" /> Document Preview
                </span>
                <span>{doc.mimeType}</span>
              </div>

              <div className="flex-1 bg-black/[0.03] dark:bg-black/30 flex items-center justify-center overflow-auto p-2">
                {isImage ? (
                  <img
                    src={fileUrl}
                    alt={doc.originalName}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <iframe
                    src={`${fileUrl}#toolbar=0`}
                    title={doc.originalName}
                    className="w-full h-full min-h-[550px] border-none rounded-lg"
                  />
                )}
              </div>
            </Card>

            {/* Source Snippet Grounding */}
            {activeField && activeField.sourceText && (
              <Card className="p-3.5 bg-[#007AFF]/5 border border-[#007AFF]/15 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#007AFF]">
                  <span>AI Grounding Source (Page {activeField.sourcePage || 1})</span>
                  <span>Field: {activeField.label || activeField.key}</span>
                </div>
                <p className="text-xs font-mono text-[#1C1C1E] dark:text-[#F2F2F7] bg-white/70 dark:bg-black/40 p-2 rounded-lg border border-[#007AFF]/20">
                  "{activeField.sourceText}"
                </p>
              </Card>
            )}
          </div>

          {/* Right Column: Extracted Fields & Validation Issues */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Validation Issues Alert Box */}
            {validationIssues.length > 0 && (
              <Card className="p-3.5 bg-[#FF9500]/10 border border-[#FF9500]/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FF9500]">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Validation Rules Flagged ({validationIssues.length})</span>
                </div>
                <ul className="space-y-1 text-xs text-[#1C1C1E] dark:text-[#F2F2F7]">
                  {validationIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#FF9500] font-bold">•</span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Extracted Fields List */}
            <Card className="p-4 space-y-4 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7]">
                  Extracted Fields ({fields.length})
                </span>
                <span className="text-[11px] text-[#6B7280]">
                  Click to inspect source
                </span>
              </div>

              {fields.length === 0 ? (
                <p className="text-xs text-[#6B7280] text-center py-8">
                  No extracted fields found. You can reprocess the document with a designated template.
                </p>
              ) : (
                <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                  {fields.map((field) => {
                    const isSelected = activeFieldKey === field.key;
                    const isLowConfidence = field.confidence < 0.7;

                    return (
                      <div
                        key={field.key}
                        onClick={() => setActiveFieldKey(field.key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#007AFF] bg-[#007AFF]/5'
                            : 'border-black/5 dark:border-white/10 hover:border-black/15 bg-white dark:bg-[#1C1C1E]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-[#6B7280]">
                            {field.label || field.key}
                          </label>
                          <div className="w-24">
                            <ConfidenceBar score={field.confidence || 0} />
                          </div>
                        </div>

                        <input
                          type="text"
                          disabled={!canReview}
                          value={field.value !== null && field.value !== undefined ? field.value : ''}
                          onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:ring-2 focus:ring-[#007AFF] ${
                            isLowConfidence ? 'border-[#FF9500]' : 'border-black/10 dark:border-white/10'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TEXT (PAGES) READ-ONLY (Spec Section 6 M3) */}
      {activeTab === 'text' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#007AFF]" />
                Extracted Text per Page (Read-Only)
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Full page text extracted with OCR and PDF parser, stored with per-page confidence for source citations.
              </p>
            </div>
            <IconButton
              icon={RefreshCw}
              size="sm"
              variant="secondary"
              onClick={fetchPages}
              label="Reload Pages"
            />
          </div>

          {pagesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#6B7280]">
              <RefreshCw className="h-6 w-6 animate-spin text-[#007AFF] mb-2" />
              <p className="text-xs">Fetching page text...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#6B7280]">
              No page text extracted yet. Reprocess document if it is in queued/failed status.
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((p) => (
                <div
                  key={p._id || p.pageNumber}
                  className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
                    <span className="text-xs font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">
                      Page {p.pageNumber}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#6B7280]">
                      OCR Confidence: {p.ocrConfidence}%
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-[#1C1C1E] dark:text-[#F2F2F7] leading-relaxed max-h-80 overflow-y-auto">
                    {p.text || '<Empty Page / No text detected>'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: SUMMARY */}
      {activeTab === 'summary' && (
        <Card className="text-center py-16 space-y-3">
          <Sparkles className="w-8 h-8 text-[#007AFF] mx-auto" />
          <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
            AI Summary Module (M7)
          </h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Short, detailed, and executive summary generation for this document will be enabled in Milestone M7.
          </p>
        </Card>
      )}

      {/* TAB 4: CHAT */}
      {activeTab === 'chat' && (
        <Card className="text-center py-16 space-y-3">
          <MessageSquare className="w-8 h-8 text-[#007AFF] mx-auto" />
          <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
            Document-Scoped AI Chat (M6)
          </h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Conversational RAG grounded exclusively in this document's pages will be enabled in Milestone M6.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/chat')}>
            Open Global Chat
          </Button>
        </Card>
      )}

      {/* Change Type / Template Modal */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        title="Change Document Type & Reprocess"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#6B7280]">
            Select a new document type to reprocess this document against the designated template schema.
          </p>
          <Select
            label="Target Template"
            value={selectedNewType}
            onChange={(e) => setSelectedNewType(e.target.value)}
            options={[
              { label: 'Select a template...', value: '' },
              ...availableTemplates.map((t) => ({ label: `${t.name} (${t.fields.length} fields)`, value: t._id }))
            ]}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
            <Button variant="secondary" size="sm" onClick={() => setShowTypeModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={reprocessing}
              disabled={!selectedNewType}
              onClick={handleChangeType}
            >
              Reprocess Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Review;
