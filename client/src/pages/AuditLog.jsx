import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Filter,
  RefreshCw,
  FileText,
  User,
  Clock,
  LogIn,
  UploadCloud,
  Edit3,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

const AuditLog = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const params = { limit: 100 };
      if (actionFilter) params.action = actionFilter;

      const { data } = await api.get('/audit', { params });
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [actionFilter]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'login':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <LogIn className="h-3 w-3" /> Login
          </span>
        );
      case 'upload':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <UploadCloud className="h-3 w-3" /> Upload
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Edit3 className="h-3 w-3" /> Correct Data
          </span>
        );
      case 'approve':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="h-3 w-3" /> Delete
          </span>
        );
      case 'export':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <FileSpreadsheet className="h-3 w-3" /> Excel Export
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Admin</span>;
      case 'reviewer':
        return <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Reviewer</span>;
      case 'employee':
        return <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Employee</span>;
      default:
        return <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Viewer</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete, immutable audit trail of user actions within your organization.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="">All Audit Actions</option>
              <option value="login">Logins</option>
              <option value="upload">Uploads</option>
              <option value="edit">Data Corrections</option>
              <option value="approve">Approvals</option>
              <option value="delete">Deletions</option>
              <option value="export">Excel Exports</option>
            </select>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            title="Refresh logs"
            className="p-2 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
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

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Fetching audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            No audit records found matching this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Document / Target</th>
                  <th className="px-6 py-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{log.userName}</span>
                        {getRoleBadge(log.userRole)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                      {log.documentName ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="max-w-xs truncate">{log.documentName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-sm truncate">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;

