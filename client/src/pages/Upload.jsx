import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  Layers
} from 'lucide-react';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const MAX_SIZE_MB = 15;

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await api.get('/templates');
        setTemplates(data.templates || []);
        if (data.templates?.length > 0) {
          setSelectedTemplateId(data.templates[0]._id);
        }
      } catch (err) {
        console.warn('Could not fetch templates:', err.message);
      }
    };
    fetchTemplates();
  }, []);

  const validateAndSetFile = (selectedFile) => {
    setError('');
    setSuccess(false);

    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError('Invalid file type. Only PDF, PNG, and JPG/JPEG files are accepted.');
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    if (selectedTemplateId) {
      formData.append('templateId', selectedTemplateId);
    }

    try {
      await api.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess(true);
      setFile(null);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to upload document. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Upload Document
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload an invoice, contract, or form to trigger OCR, LLM extraction, and validation.
        </p>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="font-semibold text-sm">Upload Successful!</div>
              <div className="text-xs text-emerald-700">
                Document queued for OCR, AI extraction, and confidence scoring.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
          >
            View in Library <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Template Selection Box */}
      {templates.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Extraction Template
              </div>
              <div className="text-[11px] text-slate-400">
                Determines which fields AI will extract from this document
              </div>
            </div>
          </div>

          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {templates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} ({t.fields.length} fields)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          file
            ? 'border-indigo-400 bg-indigo-50/20'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => validateAndSetFile(e.target.files[0])}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            {file ? 'File selected' : 'Drag & drop your document here'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Supports PDF, PNG, JPG or JPEG (Max 15MB)
          </p>
          <button
            type="button"
            className="mt-4 px-4 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
          >
            Browse files
          </button>
        </div>
      </div>

      {/* Selected File Card */}
      {file && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="truncate max-w-sm">
              <div className="font-semibold text-sm text-slate-900 truncate">
                {file.name}
              </div>
              <div className="text-xs text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Document'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              disabled={uploading}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-indigo-200 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                'Upload & Extract'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
