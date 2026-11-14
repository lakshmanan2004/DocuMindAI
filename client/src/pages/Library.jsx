import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Folder as FolderIcon,
  FolderPlus,
  Edit2,
  MoreVertical,
  Calendar,
  Download,
  ChevronDown
} from 'lucide-react';
import { Button, IconButton, Card, Input, Select, StatusBadge, Modal } from '../ui';

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState('all'); // 'all' | 'none' | folderId
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deletingId, setDeletingId] = useState(null);
  const [reprocessingId, setReprocessingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const handleExport = async (format = 'excel') => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = {};
      if (selectedIds.size > 0) {
        payload.documentIds = Array.from(selectedIds);
      }

      const endpoint = format === 'csv' ? '/export/csv' : '/export/excel';
      const res = await api.post(endpoint, payload, { responseType: 'blob' });

      const blob = new Blob([res.data], {
        type:
          format === 'csv'
            ? 'text/csv;charset=utf-8;'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute(
        'download',
        `DocuMind_Export_${timestamp}.${format === 'csv' ? 'csv' : 'xlsx'}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export documents. Please try again.');
    } finally {
      setExporting(false);
      setShowExportDropdown(false);
    }
  };

  // Folder Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);

  // Reprocess Modal
  const [reprocessDoc, setReprocessDoc] = useState(null);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [newReprocessTemplateId, setNewReprocessTemplateId] = useState('');

  const fetchFolders = async () => {
    try {
      const { data } = await api.get('/folders');
      setFolders(data.folders || []);
      setUnassignedCount(data.unassignedCount || 0);
    } catch (err) {
      console.warn('Failed to load folders:', err.message);
    }
  };

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.q = search;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (docTypeFilter && docTypeFilter !== 'all') params.docType = docTypeFilter;
      if (selectedFolder && selectedFolder !== 'all') params.folderId = selectedFolder;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const { data } = await api.get('/documents', { params });
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
    api.get('/templates').then((res) => setAvailableTemplates(res.data?.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchDocuments(true);
  }, [statusFilter, docTypeFilter, selectedFolder, startDate, endDate]);

  // Polling for documents being processed in background (every 3 to 5s per Spec)
  useEffect(() => {
    const hasActiveJobs = documents.some(
      (doc) => doc.status === 'queued' || doc.status === 'processing'
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [documents]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments(true);
  };

  // Folder Actions (Admin only)
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      if (editingFolder) {
        await api.patch(`/folders/${editingFolder._id}`, { name: newFolderName });
      } else {
        await api.post('/folders', { name: newFolderName });
      }
      setShowFolderModal(false);
      setNewFolderName('');
      setEditingFolder(null);
      await fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save folder');
    }
  };

  const handleDeleteFolder = async (folderId, folderName) => {
    if (!window.confirm(`Delete folder "${folderName}"? Documents will be moved to No folder.`)) {
      return;
    }
    try {
      await api.delete(`/folders/${folderId}`);
      if (selectedFolder === folderId) setSelectedFolder('all');
      await fetchFolders();
      await fetchDocuments(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete folder');
    }
  };

  // Single & Bulk Delete
  const handleDelete = async (docId, docName) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${docName}"?`)) {
      return;
    }

    setDeletingId(docId);
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete all ${selectedIds.size} selected document(s)?`)) return;

    try {
      await api.post('/documents/bulk-delete', {
        documentIds: Array.from(selectedIds)
      });
      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d._id)));
      setSelectedIds(new Set());
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete selected documents');
    }
  };

  // Reprocess Document
  const handleOpenReprocess = (doc) => {
    setReprocessDoc(doc);
    setNewReprocessTemplateId(doc.templateId?._id || doc.templateId || '');
  };

  const handleConfirmReprocess = async () => {
    if (!reprocessDoc) return;
    setReprocessingId(reprocessDoc._id);
    try {
      await api.post(`/documents/${reprocessDoc._id}/reprocess`, {
        templateId: newReprocessTemplateId || null
      });
      setReprocessDoc(null);
      await fetchDocuments(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reprocess document');
    } finally {
      setReprocessingId(null);
    }
  };

  // Selection
  const toggleSelectDoc = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d._id)));
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
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
            Document Library
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Browse, filter, preview, and manage multi-tenant documents across folders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Export Dropdown (Milestone M7) */}
          {user?.role !== 'viewer' && (
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                icon={FileSpreadsheet}
                onClick={() => setShowExportDropdown((prev) => !prev)}
                disabled={exporting}
                className="flex items-center gap-1.5"
              >
                {exporting ? 'Exporting...' : selectedIds.size > 0 ? `Export (${selectedIds.size})` : 'Export'}
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
              </Button>

              {showExportDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportDropdown(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Export Options {selectedIds.size > 0 ? `(${selectedIds.size} Selected)` : '(All)'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport('excel')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-medium">Excel (.xlsx) Multi-Sheet</div>
                        <div className="text-[10px] text-slate-400">Includes separate sheets for tables</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="font-medium">Flat CSV (.csv)</div>
                        <div className="text-[10px] text-slate-400">Standard tabular comma-separated values</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedIds.size > 0 && user?.role !== 'viewer' && (
            <Button
              variant="destructive"
              size="sm"
              icon={Trash2}
              onClick={handleBulkDelete}
            >
              Delete ({selectedIds.size})
            </Button>
          )}

          {user?.role !== 'viewer' && (
            <Button
              variant="primary"
              size="sm"
              icon={UploadCloud}
              onClick={() => navigate('/upload')}
            >
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout: Folders Sidebar + Documents Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Folder Manager */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-1.5">
                <FolderIcon className="w-3.5 h-3.5 text-[#007AFF]" />
                Folders
              </span>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setNewFolderName('');
                    setShowFolderModal(true);
                  }}
                  className="p-1 text-[#007AFF] hover:bg-[#007AFF]/10 rounded-lg cursor-pointer transition-colors"
                  title="Create New Folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFolder('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  selectedFolder === 'all'
                    ? 'bg-[#007AFF] text-white font-semibold'
                    : 'text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>All Documents</span>
                <span className="text-[11px] opacity-80">{documents.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFolder('none')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  selectedFolder === 'none'
                    ? 'bg-[#007AFF] text-white font-semibold'
                    : 'text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>No Folder</span>
                <span className="text-[11px] opacity-80">{unassignedCount}</span>
              </button>

              {folders.map((folder) => (
                <div
                  key={folder._id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                    selectedFolder === folder._id
                      ? 'bg-[#007AFF] text-white font-semibold'
                      : 'text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedFolder(folder._id)}
                >
                  <span className="truncate pr-2">📁 {folder.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] opacity-80">{folder.documentCount || 0}</span>
                    {user?.role === 'admin' && selectedFolder !== folder._id && (
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolder(folder);
                            setNewFolderName(folder.name);
                            setShowFolderModal(true);
                          }}
                          className="p-1 hover:text-[#007AFF]"
                          title="Rename Folder"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder._id, folder.name);
                          }}
                          className="p-1 hover:text-[#FF3B30]"
                          title="Delete Folder"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Content: Filters & Documents Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter Bar */}
          <Card className="p-3.5 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents by name..."
                  className="w-full pl-9 pr-4 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#007AFF] text-[#1C1C1E] dark:text-[#F2F2F7]"
                />
              </form>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs rounded-xl px-2.5 py-2 text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="completed">Completed</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="failed">Failed</option>
                </select>

                <select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs rounded-xl px-2.5 py-2 text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Contract or Agreement">Contract</option>
                  <option value="Mark Sheet">Mark Sheet</option>
                  <option value="Lab Report">Lab Report</option>
                  <option value="Purchase Order">Purchase Order</option>
                  <option value="Other">Other</option>
                </select>

                <IconButton
                  icon={RefreshCw}
                  size="sm"
                  variant="secondary"
                  onClick={() => fetchDocuments(true)}
                  label="Refresh"
                />
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Documents Table */}
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw className="h-7 w-7 animate-spin text-[#007AFF] mb-2.5" />
                <p className="text-xs">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                <div className="h-12 w-12 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center mb-3">
                  <FileQuestion className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">No documents found</h3>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm">
                  {search || statusFilter !== 'all' || docTypeFilter !== 'all'
                    ? 'Try adjusting your filters or search keywords.'
                    : 'Upload a document or photo to start automated processing.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-black/5 dark:divide-white/5 text-left text-xs">
                  <thead className="bg-black/[0.02] dark:bg-white/[0.02] text-[#6B7280] font-semibold uppercase tracking-wider">
                    <tr>
                      {user?.role !== 'viewer' && (
                        <th scope="col" className="px-4 py-3.5 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-[#6B7280] hover:text-[#007AFF] cursor-pointer"
                          >
                            {selectedIds.size === documents.length && documents.length > 0 ? (
                              <CheckSquare className="h-4 w-4 text-[#007AFF]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </th>
                      )}
                      <th scope="col" className="px-5 py-3.5">Document</th>
                      <th scope="col" className="px-4 py-3.5">Type</th>
                      <th scope="col" className="px-4 py-3.5">Folder</th>
                      <th scope="col" className="px-4 py-3.5">Status</th>
                      <th scope="col" className="px-4 py-3.5">Uploaded By</th>
                      <th scope="col" className="px-4 py-3.5">Date</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {documents.map((doc) => {
                      const isSelected = selectedIds.has(doc._id);
                      const canDelete =
                        user?.role === 'admin' ||
                        (user?.role === 'employee' &&
                          (doc.uploadedBy?._id === user?.id || doc.uploadedBy === user?.id));
                      const canReprocess = user?.role === 'admin' || user?.role === 'reviewer';

                      return (
                        <tr
                          key={doc._id}
                          className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${
                            isSelected ? 'bg-[#007AFF]/5' : ''
                          }`}
                        >
                          {user?.role !== 'viewer' && (
                            <td className="px-4 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSelectDoc(doc._id)}
                                className="text-[#6B7280] hover:text-[#007AFF] cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-[#007AFF]" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          )}

                          <td className="px-5 py-3.5 font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="truncate max-w-xs">
                                <Link
                                  to={`/documents/${doc._id}`}
                                  className="font-semibold text-xs text-[#1C1C1E] dark:text-[#F2F2F7] hover:text-[#007AFF] transition-colors truncate block"
                                >
                                  {doc.originalName}
                                </Link>
                                <div className="text-[11px] text-[#6B7280]">
                                  {formatFileSize(doc.size)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-black/5 dark:bg-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] font-medium">
                              {doc.docType || doc.templateId?.name || 'Other'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-[#6B7280]">
                            {doc.folderId?.name ? `📁 ${doc.folderId.name}` : '—'}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <StatusBadge status={doc.status} />
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-[#6B7280]">
                            {doc.uploadedBy?.name || 'Unknown'}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-[#6B7280]">
                            {formatDate(doc.createdAt)}
                          </td>

                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1">
                            {/* File Stream Preview (Authenticated) */}
                            <a
                              href={`/api/documents/${doc._id}/file`}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview File"
                              className="inline-flex p-1.5 text-[#6B7280] hover:text-[#007AFF] rounded-lg transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>

                            {/* Reprocess */}
                            {canReprocess && (
                              <button
                                type="button"
                                onClick={() => handleOpenReprocess(doc)}
                                disabled={reprocessingId === doc._id}
                                title="Reprocess Document"
                                className="inline-flex p-1.5 text-[#6B7280] hover:text-[#FF9500] rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCw className={`h-3.5 w-3.5 ${reprocessingId === doc._id ? 'animate-spin' : ''}`} />
                              </button>
                            )}

                            {/* Delete */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(doc._id, doc.originalName)}
                                disabled={deletingId === doc._id}
                                title="Delete Document"
                                className="inline-flex p-1.5 text-[#6B7280] hover:text-[#FF3B30] rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
          </Card>
        </div>
      </div>

      {/* Folder Modal */}
      <Modal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        title={editingFolder ? 'Rename Folder' : 'Create New Folder'}
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            label="Folder Name"
            required
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. Q4 Invoices, Vendor Contracts"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
            <Button variant="secondary" size="sm" onClick={() => setShowFolderModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingFolder ? 'Save Changes' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reprocess Modal */}
      <Modal
        isOpen={!!reprocessDoc}
        onClose={() => setReprocessDoc(null)}
        title="Reprocess Document"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#6B7280]">
            Reprocessing will clear existing extraction, re-run OCR and text extraction, re-classify, and re-embed. You can optionally re-assign the template.
          </p>

          <Select
            label="Document Template"
            value={newReprocessTemplateId}
            onChange={(e) => setNewReprocessTemplateId(e.target.value)}
            options={[
              { label: 'Auto-Detect / Keep Current', value: '' },
              ...availableTemplates.map((t) => ({ label: t.name, value: t._id }))
            ]}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
            <Button variant="secondary" size="sm" onClick={() => setReprocessDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmReprocess} loading={!!reprocessingId}>
              Start Reprocessing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Library;
