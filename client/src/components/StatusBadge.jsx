import React from 'react';

const statusConfig = {
  uploaded: {
    label: 'Uploaded',
    bg: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  queued: {
    label: 'Queued',
    bg: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  processing: {
    label: 'Processing',
    bg: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  needs_review: {
    label: 'Needs Review',
    bg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  reviewed: {
    label: 'Reviewed',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  failed: {
    label: 'Failed',
    bg: 'bg-rose-50 text-rose-700 border-rose-200'
  }
};

const StatusBadge = ({ status }) => {
  const current = statusConfig[status] || {
    label: status || 'Unknown',
    bg: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg}`}
    >
      {current.label}
    </span>
  );
};

export default StatusBadge;

