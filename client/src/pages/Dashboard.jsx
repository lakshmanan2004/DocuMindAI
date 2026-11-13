import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  LayoutDashboard,
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
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {organization?.name || 'Workspace'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-indigo-200 mt-1 max-w-xl">
            DocuMind AI is actively monitoring, extracting, and indexing your organization's business documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDashboardData(true)}
            title="Refresh dashboard stats"
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {user?.role !== 'viewer' && (
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Document
            </Link>
          )}
        </div>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Documents
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {stats?.statusCounts?.total ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 inline-block">
              Across organization
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        {/* Needs Review */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Needs Review
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {stats?.statusCounts?.needs_review ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-amber-600 font-medium mt-0.5 inline-block">
              Flagged for human check
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Reviewed / Approved */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Approved & Ready
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {(stats?.statusCounts?.reviewed || 0) + (stats?.statusCounts?.completed || 0)}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 inline-block">
              Verified records
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
              Team Members
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {stats?.totalUsers ?? (loading ? '...' : 0)}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 inline-block">
              Active in 4 roles
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/chat"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-600 transition-all" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Ask AI Chat</h3>
          <p className="text-xs text-slate-500 mt-1">
            Query document contents with semantic vector search and source citations.
          </p>
        </Link>

        <Link
          to="/library"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-600 transition-all" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Document Library & Export</h3>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified files or export all structured data directly to an Excel sheet.
          </p>
        </Link>

        {user?.role === 'admin' ? (
          <Link
            to="/audit"
            className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-600 transition-all" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-1">
              Inspect user activity, login events, and approved document changes.
            </p>
          </Link>
        ) : (
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-slate-200/60 text-slate-600 flex items-center justify-center mb-3">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">Role-Based Access</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are logged in as <span className="font-semibold uppercase text-indigo-600">{user?.role}</span>.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 mt-2">Protected by DocuMind RBAC</span>
          </div>
        )}
      </div>

      {/* Recent Documents Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="font-bold text-slate-900 text-sm">Recent Documents</h2>
          </div>
          <Link
            to="/library"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All in Library →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
            <p className="text-xs">Loading recent documents...</p>
          </div>
        ) : !stats?.recentDocuments || stats.recentDocuments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No documents uploaded yet. Click "Upload Document" to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentDocuments.map((doc) => (
              <div
                key={doc._id}
                className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate max-w-sm">
                      {doc.originalName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Uploaded by {doc.uploadedBy?.name || 'User'} • {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={doc.status} />
                  {['needs_review', 'completed', 'reviewed'].includes(doc.status) && (
                    <Link
                      to={`/review/${doc._id}`}
                      className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200/60"
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

