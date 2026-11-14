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
  UserCheck,
  UserX
} from 'lucide-react';
import { Button, Card, Modal, Input, Select } from '../ui';

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
        return 'bg-[#5856D6]/12 text-[#5856D6] border-[#5856D6]/25';
      case 'reviewer':
        return 'bg-[#34C759]/12 text-[#34C759] border-[#34C759]/25';
      case 'employee':
        return 'bg-[#FF9500]/12 text-[#FF9500] border-[#FF9500]/25';
      default:
        return 'bg-black/5 dark:bg-white/10 text-[#8E8E93] border-black/10 dark:border-white/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
              <UsersIcon className="h-4 w-4" />
            </div>
            Team & Roles
          </h1>
          <p className="text-sm text-[#6B7280] dark:text-[#8E8E93] mt-0.5">
            Manage organization members, assign roles (Admin, Employee, Reviewer, Viewer), and manage account activations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
        <div className="p-3.5 rounded-[14px] bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-[14px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* User Table (Apple Style) */}
      <Card className="p-0 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#8E8E93]">
            <RefreshCw className="h-7 w-7 animate-spin text-[#007AFF] mb-2.5" />
            <p className="text-xs font-medium">Fetching team members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-[#8E8E93] text-sm">
            No team members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/10 text-[#8E8E93] font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Current Role</th>
                  <th className="px-4 py-3.5">Change Role</th>
                  <th className="px-4 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {users.map((u) => {
                  const isSelf = u._id === currentUser?.id;
                  const isActive = u.isActive !== false;
                  return (
                    <tr key={u._id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-1.5">
                          {u.name}
                          {isSelf && (
                            <span className="text-[10px] bg-[#007AFF]/12 text-[#007AFF] px-1.5 py-0.5 rounded-full font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8E8E93]">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isActive
                              ? 'bg-[#34C759]/12 text-[#34C759]'
                              : 'bg-[#FF3B30]/12 text-[#FF3B30]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="px-2.5 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 rounded-[10px] text-xs font-medium text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:opacity-40 cursor-pointer transition-all"
                        >
                          <option value="admin">Admin</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="employee">Employee</option>
                          <option value="viewer">Viewer (Read-Only)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#8E8E93]">
                        {u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-1">
                        {!isSelf && (
                          <>
                            <button
                              onClick={() => handleToggleActive(u._id, isActive)}
                              title={isActive ? 'Deactivate user' : 'Activate user'}
                              className={`p-1.5 rounded-[8px] transition-colors cursor-pointer active:scale-95 ${
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
                              className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-[8px] transition-colors cursor-pointer active:scale-95"
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
      <Card className="bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 p-5">
        <h3 className="font-bold text-[#1C1C1E] dark:text-[#F2F2F7] text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <ShieldCheck className="h-4 w-4 text-[#007AFF]" />
          4-Tier Permissions Guide (Tenant Isolation)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-[14px] border border-black/5 dark:border-white/10">
            <span className="font-bold text-[#5856D6] uppercase text-[11px]">Org Admin</span>
            <p className="text-[#6B7280] dark:text-[#8E8E93] mt-1 leading-relaxed text-[11px]">
              Full control. Manages templates, users, audit logs, and can delete any document.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-[14px] border border-black/5 dark:border-white/10">
            <span className="font-bold text-[#34C759] uppercase text-[11px]">Reviewer</span>
            <p className="text-[#6B7280] dark:text-[#8E8E93] mt-1 leading-relaxed text-[11px]">
              Edits extracted fields, validates rules, approves documents, exports to Excel.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-[14px] border border-black/5 dark:border-white/10">
            <span className="font-bold text-[#FF9500] uppercase text-[11px]">Employee</span>
            <p className="text-[#6B7280] dark:text-[#8E8E93] mt-1 leading-relaxed text-[11px]">
              Uploads documents, chats with RAG, exports data. Can delete only own uploads.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] p-3.5 rounded-[14px] border border-black/5 dark:border-white/10">
            <span className="font-bold text-[#8E8E93] uppercase text-[11px]">Viewer</span>
            <p className="text-[#6B7280] dark:text-[#8E8E93] mt-1 leading-relaxed text-[11px]">
              Read-only auditor. Can view documents and query AI Chat. Action buttons hidden.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Member Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Organization Member"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Sarah Jenkins"
          />
          <Input
            label="Work Email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="sarah@company.com"
          />
          <Input
            label="Password (min 8 characters)"
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
          />
          <Select
            label="Assign Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[
              { label: 'Employee (Upload, Chat, Export)', value: 'employee' },
              { label: 'Reviewer (Review & Verify Fields, Export)', value: 'reviewer' },
              { label: 'Viewer (Read-Only)', value: 'viewer' },
              { label: 'Org Admin (Full Administrative Access)', value: 'admin' }
            ]}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/10">
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
