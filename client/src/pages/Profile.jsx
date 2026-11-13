import React, { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
  ShieldCheck,
  Sun,
  Moon,
  Zap
} from 'lucide-react';
import { Button, Card, Input, Switch } from '../ui';
import { setLiteMode, getLiteMode } from '../lib/performance';

const rolePermissions = {
  admin: {
    title: 'Organization Administrator',
    color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
    capabilities: [
      'Full administrative authority across the organization',
      'Manage team members, create users, and reassign roles',
      'Create, edit, and archive extraction templates',
      'Upload, review, edit, approve, and delete documents',
      'Export bulk extracted records to Excel (.xlsx) and CSV',
      'Access organization-wide immutable audit trail and security logs'
    ]
  },
  reviewer: {
    title: 'Data Auditor & Reviewer',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
    capabilities: [
      'Access document library and dual-pane review screen',
      'Verify and correct AI-extracted metadata fields and table grids',
      'Approve verified documents as organizational ground-truth',
      'Upload incoming documents for automated processing',
      'Export verified dataset to Excel (.xlsx)',
      'Query the AI conversational knowledge base'
    ]
  },
  employee: {
    title: 'Operations Executive',
    color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
    capabilities: [
      'Upload documents for background OCR and AI extraction',
      'Browse organizational documents and view extracted values',
      'Interact with RAG conversational assistant with source citations',
      'Export own uploaded documents to Excel (.xlsx)',
      'Delete own uploaded documents prior to review'
    ]
  },
  viewer: {
    title: 'Read-Only Viewer',
    color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    capabilities: [
      'Browse approved organizational documents',
      'Interact with RAG AI Chat assistant to ask questions',
      'View extracted fields and metadata in read-only mode',
      'Restricted from uploading, editing, approving, or exporting data'
    ]
  }
};

const Profile = () => {
  const { user, organization, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isLite, setIsLite] = useState(() => getLiteMode());

  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const currentRoleInfo = rolePermissions[user?.role] || rolePermissions.employee;

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const toggleLiteMode = () => {
    const next = !isLite;
    setIsLite(next);
    setLiteMode(next);
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSavingName(true);

    try {
      const { data } = await api.patch('/auth/me', { name });
      updateUser(data.user);
      setSuccess('Profile name updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch('/auth/me/password', {
        currentPassword,
        newPassword
      });
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const getInitials = (str) => {
    if (!str) return 'U';
    return str
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">Account & Settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Manage your profile credentials, theme preferences, and review your role capabilities.
        </p>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 text-sm shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2 text-sm shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Summary Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-indigo-600 text-white font-bold text-2xl flex items-center justify-center mx-auto shadow-md">
              {getInitials(user?.name)}
            </div>
            <h2 className="mt-4 font-bold text-lg text-[#1C1C1E] dark:text-[#F2F2F7]">{user?.name}</h2>
            <p className="text-xs text-[#6B7280] flex items-center justify-center gap-1 mt-1">
              <Mail className="h-3 w-3" />
              {user?.email}
            </p>

            <div className="mt-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${currentRoleInfo.color}`}>
                {user?.role}
              </span>
            </div>

            <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/10 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Organization
                </span>
                <span className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{organization?.name || 'Workspace'}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Account Status
                </span>
                <span className="text-[#34C759] font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]"></span> Active
                </span>
              </div>
            </div>
          </Card>

          {/* Settings & Appearance */}
          <Card className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7]">
              Appearance & Performance
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                {isDark ? <Moon className="w-4 h-4 text-[#007AFF]" /> : <Sun className="w-4 h-4 text-[#FF9500]" />}
                Dark Theme
              </span>
              <Switch checked={isDark} onChange={toggleDarkMode} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
              <span className="text-sm text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#34C759]" />
                Lite Mode (No Blur)
              </span>
              <Switch checked={isLite} onChange={toggleLiteMode} />
            </div>
          </Card>

          {/* Role Capabilities Card */}
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#007AFF]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1C1E] dark:text-[#F2F2F7]">
                Role Permissions
              </h3>
            </div>
            <p className="text-xs font-semibold text-[#007AFF]">
              {currentRoleInfo.title}
            </p>
            <ul className="space-y-1.5 text-[11px] text-[#6B7280]">
              {currentRoleInfo.capabilities.map((cap, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[#34C759] font-bold shrink-0">✓</span>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right Column: Update Name & Change Password Forms */}
        <div className="md:col-span-2 space-y-6">
          <Card className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                <User className="h-4 w-4 text-[#007AFF]" />
                Personal Profile
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Update your display name. Email address is permanently unique to your account.
              </p>
            </div>

            <form onSubmit={handleUpdateName} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address (read-only)"
                value={user?.email || ''}
                readOnly
                disabled
              />
              <div className="flex justify-end">
                <Button type="submit" loading={savingName} size="sm">
                  Save Name
                </Button>
              </div>
            </form>
          </Card>

          <Card className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#007AFF]" />
                Change Password
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Ensure your password is at least 8 characters long for multi-tenant security.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={savingPassword} size="sm">
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
