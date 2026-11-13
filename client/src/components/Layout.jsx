import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  UploadCloud,
  Layers,
  MessageSquare,
  FileCheck,
  Users,
  LogOut,
  Building2,
  ShieldCheck
} from 'lucide-react';

const Layout = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Document Library', path: '/library', icon: FileText },
    { name: 'Upload Documents', path: '/upload', icon: UploadCloud },
    // Roadmap tabs visible with MVP readiness
    { name: 'Templates', path: '/templates', icon: Layers, adminOnly: true },
    { name: 'AI Chat', path: '/chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-200">
              DM
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">DocuMind</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                MVP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Tenant indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/60 text-xs font-medium text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span>{organization?.name || 'Workspace'}</span>
            </div>

            {/* User profile & role badge */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900">{user?.name}</div>
                <div className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                  {user?.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sub-nav tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col">
        {/* Navigation Bar */}
        <nav className="flex space-x-2 border-b border-slate-200 pb-4 mb-6 overflow-x-auto">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Dynamic Nested Page Content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

