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
import { Button, Card, StatusBadge } from '../ui';

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20">
            <LogIn className="h-3 w-3" /> Login
          </span>
        );
      case 'upload':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#5856D6]/10 text-[#5856D6] border border-[#5856D6]/20">
            <UploadCloud className="h-3 w-3" /> Upload
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/20">
            <Edit3 className="h-3 w-3" /> Correction
          </span>
        );
      case 'approve':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20">
            <Trash2 className="h-3 w-3" /> Delete
          </span>
        );
      case 'export':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20">
            <FileSpreadsheet className="h-3 w-3" /> Export
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-black/[0.05] dark:bg-white/[0.08] text-[#6B7280]">
            {action}
          </span>
        );
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-[#5856D6] bg-[#5856D6]/10 px-2 py-0.5 rounded-[6px] border border-[#5856D6]/20">Admin</span>;
      case 'reviewer':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-[6px] border border-[#34C759]/20">Reviewer</span>;
      case 'employee':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9500] bg-[#FF9500]/10 px-2 py-0.5 rounded-[6px] border border-[#FF9500]/20">Employee</span>;
      default:
        return <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-[6px]">Viewer</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#007AFF]" />
            Audit Trail
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Complete, immutable audit trail of user actions within your organization.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] rounded-[12px] px-3 py-1.5 text-xs shadow-xs">
            <Filter className="h-3.5 w-3.5 text-[#8E8E93]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent border-none text-[#1C1C1E] dark:text-[#F2F2F7] font-medium text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="dark:bg-[#1C1C1E]">All Actions</option>
              <option value="login" className="dark:bg-[#1C1C1E]">Logins</option>
              <option value="upload" className="dark:bg-[#1C1C1E]">Uploads</option>
              <option value="edit" className="dark:bg-[#1C1C1E]">Data Corrections</option>
              <option value="approve" className="dark:bg-[#1C1C1E]">Approvals</option>
              <option value="delete" className="dark:bg-[#1C1C1E]">Deletions</option>
              <option value="export" className="dark:bg-[#1C1C1E]">Excel Exports</option>
            </select>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            title="Refresh logs"
            className="p-2 border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] rounded-[12px] text-[#6B7280] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-all shadow-xs active:scale-[0.97] cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-[14px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.05] dark:border-white/[0.08] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#8E8E93]">
            <RefreshCw className="h-7 w-7 animate-spin text-[#007AFF] mb-3" />
            <p className="text-sm">Fetching audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-[#8E8E93] text-sm">
            No audit records found matching this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#F2F2F7]/95 dark:bg-[#2C2C2E]/95 backdrop-blur-sm border-b border-black/[0.05] dark:border-white/[0.08] text-[#8E8E93] font-semibold text-[11px] uppercase tracking-wider shadow-2xs">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Document / Target</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#8E8E93] font-mono">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1C1C1E] dark:text-[#F2F2F7]">{log.userName}</span>
                        {getRoleBadge(log.userRole)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#1C1C1E] dark:text-[#F2F2F7]">
                      {log.documentName ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <FileText className="h-3.5 w-3.5 text-[#8E8E93]" />
                          <span className="max-w-xs truncate">{log.documentName}</span>
                        </div>
                      ) : (
                        <span className="text-[#8E8E93]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6B7280] max-w-sm truncate">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <span className="font-mono text-[11px] bg-black/[0.03] dark:bg-white/[0.06] text-[#1C1C1E] dark:text-[#F2F2F7] px-2 py-1 rounded-[6px] border border-black/[0.04] dark:border-white/[0.06]">
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        <span className="text-[#8E8E93]">—</span>
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
