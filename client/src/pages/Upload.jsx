import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Layers,
  Folder as FolderIcon
} from 'lucide-react';
import { Button, Card, Select, StatusBadge } from '../ui';

const Upload = () => {
  const [fileList, setFileList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
  const MAX_SIZE_MB = 15;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tmplRes, folderRes] = await Promise.all([
          api.get('/templates').catch(() => ({ data: { templates: [] } })),
          api.get('/folders').catch(() => ({ data: { folders: [] } }))
        ]);
        setTemplates(tmplRes.data?.templates || []);
        setFolders(folderRes.data?.folders || []);
      } catch (err) {
        console.warn('Could not fetch templates/folders:', err.message);
      }
    };
    fetchData();
  }, []);

  const validateFiles = (newFiles) => {
    setError('');
    const valid = [];
    for (const f of newFiles) {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`File '${f.name}' has an unsupported extension. Allowed: PDF, PNG, JPG, JPEG.`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File '${f.name}' exceeds maximum size of ${MAX_SIZE_MB}MB.`);
        continue;
      }
      valid.push(f);
    }

    setFileList((prev) => [...prev, ...valid]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeFile = (index) => {
    setFileList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadAll = async () => {
    if (fileList.length === 0) return;

    setUploading(true);
    setError('');
    setUploadResults([]);

    const formData = new FormData();
    for (const f of fileList) {
      formData.append('files', f);
    }
    if (selectedTemplateId) {
      formData.append('templateId', selectedTemplateId);
    }
    if (selectedFolderId) {
      formData.append('folderId', selectedFolderId);
    }

    try {
      const { data } = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResults(data.documents || (data.document ? [data.document] : []));
      setFileList([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload documents. Please check file format.');
    } finally {
      setUploading(false);
    }
  };

  const templateOptions = [
    { label: 'Auto-Detect Document Type', value: '' },
    ...templates.map((t) => ({ label: `${t.name} (${t.fields?.length || 0} fields)`, value: t._id }))
  ];

  const folderOptions = [
    { label: 'No folder (Root Library)', value: '' },
    ...folders.map((f) => ({ label: `📁 ${f.name}`, value: f._id }))
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
          Upload Documents
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Upload PDFs or images for background OCR, AI classification, schema-driven field extraction, and vector embedding.
        </p>
      </div>

      {/* Upload Results Success Banner */}
      {uploadResults.length > 0 && (
        <Card className="bg-[#34C759]/10 border border-[#34C759]/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#34C759] font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>{uploadResults.length} document(s) uploaded and queued for background processing!</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/library')}
              icon={ArrowRight}
            >
              Go to Library
            </Button>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-[#34C759]/20">
            {uploadResults.map((doc) => (
              <div key={doc._id} className="flex items-center justify-between text-xs text-[#1C1C1E] dark:text-[#F2F2F7]">
                <span className="font-medium truncate max-w-md">{doc.originalName}</span>
                <StatusBadge status={doc.status} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-[16px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Grid: Template & Folder Pickers */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Select
            label="Target Template (Optional)"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            options={templateOptions}
          />
          <span className="text-[11px] text-[#6B7280] mt-1 block">
            Leave as Auto-Detect for DocuMind to identify the template automatically.
          </span>
        </div>

        <div>
          <Select
            label="Assign Folder (Optional)"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            options={folderOptions}
          />
          <span className="text-[11px] text-[#6B7280] mt-1 block">
            Organize documents into single-level tenant folders.
          </span>
        </div>
      </Card>

      {/* Drag & Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[20px] p-10 text-center cursor-pointer transition-all ${
          fileList.length > 0
            ? 'border-[#007AFF] bg-[#007AFF]/5'
            : 'border-black/15 dark:border-white/15 hover:border-[#007AFF] bg-white dark:bg-[#1C1C1E]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => validateFiles(Array.from(e.target.files))}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center mb-4">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
            {fileList.length > 0 ? `${fileList.length} file(s) selected` : 'Drag & drop your files here'}
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            Supports multi-file upload for PDF, PNG, JPG or JPEG (Max 15MB each)
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse files
          </Button>
        </div>
      </div>

      {/* Selected Files Staging List */}
      {fileList.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <h4 className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">
              Ready to Upload ({fileList.length})
            </h4>
            <Button
              variant="primary"
              size="sm"
              loading={uploading}
              onClick={handleUploadAll}
            >
              Upload All Documents
            </Button>
          </div>

          <div className="divide-y divide-black/5 dark:divide-white/10 max-h-64 overflow-y-auto">
            {fileList.map((f, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate max-w-md">
                  <div className="h-8 w-8 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate">{f.name}</div>
                    <div className="text-[11px] text-[#6B7280]">
                      {(f.size / (1024 * 1024)).toFixed(2)} MB • {f.type || 'Document'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="p-1.5 text-[#6B7280] hover:text-[#FF3B30] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Upload;
