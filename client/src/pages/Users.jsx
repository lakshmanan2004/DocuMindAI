import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users as UsersIcon,
  UserPlus,
  ShieldCheck,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  UserCheck,
  UserX
} from 'lucide-react';
import { Button, Card, Modal, Input, Select, StatusBadge } from '../ui';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add User Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load team members');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}`, { role: newRole });
      setSuccess(`Role updated to ${newRole}`);
      setTimeout(() => setSuccess(''), 3000);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    const nextActive = !currentActive;
    try {
      await api.patch(`/users/${userId}`, { isActive: nextActive });
      setSuccess(`User ${nextActive ? 'activated' : 'deactivated'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: nextActive } : u))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from the organization?`)) {
      return;
    }
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setSuccess('User removed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/users', formData);
      setUsers((prev) => [data.user, ...prev]);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'employee' });
      setSuccess('New team member added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'reviewer':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'employee':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-[#007AFF]" />
            Team & Role Management
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage organization members, assign roles (Admin, Employee, Reviewer, Viewer), and manage account activations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchUsers(true)}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowModal(true)}
            icon={UserPlus}
          >
            Add Member
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* User Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin text-[#007AFF] mb-3" />
            <p className="text-sm">Fetching team members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No team members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/10 text-[#6B7280] font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Current Role</th>
                  <th className="px-6 py-4">Change Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {users.map((u) => {
                  const isSelf = u._id === currentUser?.id;
                  const isActive = u.isActive !== false;
                  return (
                    <tr key={u._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
                          {u.name}
                          {isSelf && (
                            <span className="text-[10px] bg-[#007AFF]/10 text-[#007AFF] px-1.5 py-0.5 rounded font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B7280]">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isActive
                              ? 'bg-[#34C759]/15 text-[#34C759]'
                              : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="px-2.5 py-1.5 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg text-xs font-medium text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:ring-2 focus:ring-[#007AFF] disabled:opacity-50 cursor-pointer"
                        >
                          <option value="admin">Admin</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="employee">Employee</option>
                          <option value="viewer">Viewer (Read-Only)</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-[#6B7280]">
                        {u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {!isSelf && (
                          <>
                            <button
                              onClick={() => handleToggleActive(u._id, isActive)}
                              title={isActive ? 'Deactivate user' : 'Activate user'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'text-[#FF9500] hover:bg-[#FF9500]/10'
                                  : 'text-[#34C759] hover:bg-[#34C759]/10'
                              }`}
                            >
                              {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u._id, u.name)}
                              title="Remove user"
                              className="p-1.5 text-gray-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
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

      {/* Role Hierarchy Reference Card */}
      <Card className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10">
        <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <ShieldCheck className="h-4 w-4 text-[#007AFF]" />
          4-Tier Permissions Guide (Tenant Isolation)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/10">
            <span className="font-bold text-purple-600 uppercase text-[11px]">Org Admin</span>
            <p className="text-[#6B7280] mt-1 leading-relaxed">
              Full control. Manages templates, users, audit logs, and can delete any document.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/10">
            <span className="font-bold text-emerald-600 uppercase text-[11px]">Reviewer</span>
            <p className="text-[#6B7280] mt-1 leading-relaxed">
              Edits extracted fields, validates rules, approves documents, exports to Excel.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/10">
            <span className="font-bold text-amber-600 uppercase text-[11px]">Employee</span>
            <p className="text-[#6B7280] mt-1 leading-relaxed">
              Uploads documents, chats with RAG, exports data. Can delete only own uploads.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/10">
            <span className="font-bold text-slate-500 uppercase text-[11px]">Viewer</span>
            <p className="text-[#6B7280] mt-1 leading-relaxed">
              Read-only auditor. Can view documents and query AI Chat. Action buttons hidden.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Member Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Team Member"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. John Doe"
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
          />

          <Input
            label="Temporary Password (min 8 characters)"
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 8 characters"
          />

          <Select
            label="Assign Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[
              { label: 'Employee (Upload & View)', value: 'employee' },
              { label: 'Reviewer (Edit & Approve)', value: 'reviewer' },
              { label: 'Org Admin (Full Access)', value: 'admin' },
              { label: 'Viewer (Read-Only)', value: 'viewer' }
            ]}
          />

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creating}>
              Create Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
