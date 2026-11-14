import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../ui';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Users,
  UploadCloud,
  MessageSquare,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';

const Dashboard = () => {
  const { user, organization } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Header Actions (Apple macOS Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#007AFF] mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{organization?.name || 'Workspace'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1C1E] dark:text-[#F2F2F7]">
            Overview
          </h1>
          <p className="text-sm text-[#6B7280] dark:text-[#8E8E93] mt-0.5">
            Real-time status of document classification, extraction, and verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            title="Refresh dashboard metrics"
            className="p-2.5 rounded-[12px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {user?.role !== 'viewer' && (
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0062CC] active:scale-[0.97] text-white text-xs sm:text-sm font-semibold rounded-[12px] shadow-sm shadow-[#007AFF]/25 transition-all cursor-pointer"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Document
            </Link>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-[14px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium">
          {error}
        </div>
      )}

      {/* Stats Counter Grid (Apple Health Style Solid Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-[0_2px_10px_rgb(0_0_0_/_0.03)] dark:shadow-[0_4px_20px_rgb(0_0_0_/_0.4)] flex items-center justify-between transition-all hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93]">
              Total Documents
            </p>
            <p className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] mt-1 tracking-tight">
              {stats?.statusCounts?.total ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-[#8E8E93] mt-0.5 inline-block">
              Across workspace
            </span>
          </div>
          <div className="h-11 w-11 rounded-[14px] bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        {/* Needs Review */}
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-[0_2px_10px_rgb(0_0_0_/_0.03)] dark:shadow-[0_4px_20px_rgb(0_0_0_/_0.4)] flex items-center justify-between transition-all hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-semibold text-[#FF9500]">
              Needs Review
            </p>
            <p className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] mt-1 tracking-tight">
              {stats?.statusCounts?.needs_review ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-[#FF9500] font-medium mt-0.5 inline-block">
              Flagged for validation
            </span>
          </div>
          <div className="h-11 w-11 rounded-[14px] bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Approved & Ready */}
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-[0_2px_10px_rgb(0_0_0_/_0.03)] dark:shadow-[0_4px_20px_rgb(0_0_0_/_0.4)] flex items-center justify-between transition-all hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-semibold text-[#34C759]">
              Verified & Ready
            </p>
            <p className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] mt-1 tracking-tight">
              {(stats?.statusCounts?.reviewed || 0) + (stats?.statusCounts?.completed || 0)}
            </p>
            <span className="text-[11px] text-[#34C759] font-medium mt-0.5 inline-block">
              Approved records
            </span>
          </div>
          <div className="h-11 w-11 rounded-[14px] bg-[#34C759]/12 text-[#34C759] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-[0_2px_10px_rgb(0_0_0_/_0.03)] dark:shadow-[0_4px_20px_rgb(0_0_0_/_0.4)] flex items-center justify-between transition-all hover:-translate-y-0.5">
          <div>
            <p className="text-xs font-semibold text-[#5856D6]">
              Team Members
            </p>
            <p className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] mt-1 tracking-tight">
              {stats?.totalUsers ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-[#8E8E93] mt-0.5 inline-block">
              Active in 4 roles
            </span>
          </div>
          <div className="h-11 w-11 rounded-[14px] bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/chat"
          className="p-5 bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-xs hover:border-[#007AFF]/40 hover:-translate-y-0.5 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-[12px] bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#8E8E93] group-hover:translate-x-1 group-hover:text-[#007AFF] transition-all" />
          </div>
          <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm">AI Document Chat</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1">
            Query document contents with semantic vector search and source citations.
          </p>
        </Link>

        <Link
          to="/library"
          className="p-5 bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-xs hover:border-[#34C759]/40 hover:-translate-y-0.5 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-[12px] bg-[#34C759]/12 text-[#34C759] flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#8E8E93] group-hover:translate-x-1 group-hover:text-[#34C759] transition-all" />
          </div>
          <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm">
            Document Library & Export
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1">
            Filter files or export structured data directly to multi-sheet Excel or CSV.
          </p>
        </Link>

        {user?.role === 'admin' ? (
          <Link
            to="/audit"
            className="p-5 bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-xs hover:border-[#5856D6]/40 hover:-translate-y-0.5 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-[12px] bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#8E8E93] group-hover:translate-x-1 group-hover:text-[#5856D6] transition-all" />
            </div>
            <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm">Audit Trail</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1">
              Inspect user activity, login events, and approved document changes.
            </p>
          </Link>
        ) : (
          <div className="p-5 bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-[12px] bg-black/5 dark:bg-white/10 text-[#6B7280] dark:text-[#8E8E93] flex items-center justify-center mb-3">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm">
                Role-Based Access
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1">
                You are logged in as{' '}
                <span className="font-semibold uppercase text-[#007AFF]">{user?.role}</span>.
              </p>
            </div>
            <span className="text-[11px] text-[#8E8E93] mt-2">Protected by DocuMind RBAC</span>
          </div>
        )}
      </div>

      {/* Recent Documents Section (Apple Inset Table Style) */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.04] dark:border-white/[0.08] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.04] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#8E8E93]" />
            <h2 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-sm">
              Recent Documents
            </h2>
          </div>
          <Link
            to="/library"
            className="text-xs font-semibold text-[#007AFF] hover:underline transition-colors"
          >
            View All in Library →
          </Link>
        </div>

        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center text-[#8E8E93]">
            <RefreshCw className="h-6 w-6 animate-spin text-[#007AFF] mb-2" />
            <p className="text-xs">Loading recent documents...</p>
          </div>
        ) : !stats?.recentDocuments || stats.recentDocuments.length === 0 ? (
          <div className="py-14 text-center text-[#8E8E93] text-xs">
            No documents uploaded yet. Click "Upload Document" to begin.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
            {stats.recentDocuments.map((doc) => (
              <div
                key={doc._id}
                className="p-4 flex items-center justify-between hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-[12px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] truncate max-w-sm">
                      {doc.originalName}
                    </p>
                    <p className="text-[11px] text-[#8E8E93]">
                      Uploaded by {doc.uploadedBy?.name || 'User'} • {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={doc.status} />
                  {['needs_review', 'completed', 'reviewed'].includes(doc.status) && (
                    <Link
                      to={`/review/${doc._id}`}
                      className="px-3 py-1 bg-black/5 dark:bg-white/10 hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#007AFF] text-[#1C1C1E] dark:text-[#F2F2F7] text-xs font-semibold rounded-[10px] transition-all cursor-pointer active:scale-95"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
