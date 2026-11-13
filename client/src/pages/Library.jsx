import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  ExternalLink,
  UploadCloud,
  FileQuestion,
  AlertCircle,
  RotateCw,
  BookOpen,
  X
} from 'lucide-react';

const Library = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [reprocessingId, setReprocessingId] = useState(null);

  // Extracted pages view modal
  const [selectedDocForPages, setSelectedDocForPages] = useState(null);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesData, setPagesData] = useState([]);

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const { data } = await api.get('/documents', { params });
      setDocuments(data.documents);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(true);
  }, [statusFilter]);

  // Polling for documents being processed in the background
  useEffect(() => {
    const hasActiveJobs = documents.some(
      (doc) => doc.status === 'queued' || doc.status === 'processing'
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments(true);
  };

  const handleReprocess = async (docId) => {
    setReprocessingId(docId);
    try {
      await api.post(`/documents/${docId}/reprocess`);
      await fetchDocuments(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reprocess document.');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleViewPages = async (doc) => {
    setSelectedDocForPages(doc);
    setPagesLoading(true);
    setPagesData([]);
    try {
      const { data } = await api.get(`/documents/${doc._id}/pages`);
      setPagesData(data.pages);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch extracted text pages.');
    } finally {
      setPagesLoading(false);
    }
  };

  const handleDelete = async (docId, docName) => {
    if (!window.confirm(`Are you sure you want to delete "${docName}"?`)) {
      return;
    }

    setDeletingId(docId);
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Document Library
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Documents processed with background OCR and page-by-page text extraction.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 transition-colors"
        >
          <UploadCloud className="h-4 w-4" />
          Upload Document
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="reviewed">Reviewed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <button
            onClick={() => fetchDocuments(true)}
            title="Refresh library"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Fetching organization documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
              <FileQuestion className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No documents found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              {search || statusFilter
                ? 'Try adjusting your search query or status filter.'
                : 'Upload your first invoice, agreement, or scanned document to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Document
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Pages
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Uploaded By
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {documents.map((doc) => {
                  const canDelete =
                    user?.role === 'admin' || doc.uploadedBy?._id === user?.id;
                  const canReprocess =
                    user?.role === 'admin' || user?.role === 'reviewer';

                  return (
                    <tr key={doc._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="truncate max-w-xs md:max-w-sm">
                          <div className="font-semibold truncate text-slate-900">
                            {doc.originalName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatDate(doc.createdAt)}
                          </div>
                          {doc.errorMessage && (
                            <div className="text-xs text-rose-600 mt-0.5">
                              {doc.errorMessage}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {doc.pageCount > 0 ? (
                          <span className="font-semibold">{doc.pageCount} page(s)</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {formatFileSize(doc.size)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {doc.uploadedBy?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {doc.uploadedBy?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap space-x-1">
                        {/* Review Extraction (Phase 3 highlight) */}
                        {['needs_review', 'completed', 'reviewed'].includes(doc.status) && (
                          <Link
                            to={`/review/${doc._id}`}
                            title="Review Extracted Fields"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200/60"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Review
                          </Link>
                        )}

                        {/* View Extracted Text */}
                        {doc.status === 'completed' && (
                          <button
                            onClick={() => handleViewPages(doc)}
                            title="View Extracted Text"
                            className="inline-flex p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>
                        )}

                        {/* Reprocess (if failed or completed) */}
                        {canReprocess && (doc.status === 'failed' || doc.status === 'completed') && (
                          <button
                            onClick={() => handleReprocess(doc._id)}
                            disabled={reprocessingId === doc._id}
                            title="Reprocess document"
                            className="inline-flex p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <RotateCw
                              className={`h-4 w-4 ${
                                reprocessingId === doc._id ? 'animate-spin' : ''
                              }`}
                            />
                          </button>
                        )}

                        {/* File preview / download */}
                        <a
                          href={`/api/documents/${doc._id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          title="Preview original file"
                          className="inline-flex p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>

                        {/* Delete action */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(doc._id, doc.originalName)}
                            disabled={deletingId === doc._id}
                            title="Delete document"
                            className="inline-flex p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Extracted Text Modal */}
      {selectedDocForPages && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Extracted Text: {selectedDocForPages.originalName}
                </h3>
                <p className="text-xs text-slate-500">
                  {pagesData.length} page(s) extracted with OCR & PDF-parse
                </p>
              </div>
              <button
                onClick={() => setSelectedDocForPages(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {pagesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
                  <p className="text-xs">Loading page text...</p>
                </div>
              ) : pagesData.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No text extracted for this document.
                </p>
              ) : (
                pagesData.map((page) => (
                  <div
                    key={page._id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                      <span className="font-semibold text-slate-800">
                        Page {page.pageNumber}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-medium">
                        Confidence: {page.ocrConfidence}%
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-slate-700 text-xs leading-relaxed max-h-60 overflow-y-auto">
                      {page.text || '<No text found on page>'}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
