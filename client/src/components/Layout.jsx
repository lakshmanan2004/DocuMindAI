import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  Layers,
  MessageSquare,
  Users,
  LogOut,
  Building2,
  ShieldCheck,
  Zap,
  Moon,
  Sun,
  UserCircle,
  Search
} from 'lucide-react';

const Layout = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  // Dark Mode
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('documind_theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('documind_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('documind_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Lite Mode (switches blur off for maximum responsiveness on low-end machines)
  const [liteMode, setLiteMode] = useState(() => {
    return localStorage.getItem('documind_lite_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('documind_lite_mode', liteMode);
    if (liteMode) {
      document.body.classList.add('lite-mode');
    } else {
      document.body.classList.remove('lite-mode');
    }
  }, [liteMode]);

  const toggleLiteMode = () => setLiteMode(!liteMode);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Document Library', path: '/library', icon: FileText },
    { name: 'Upload', path: '/upload', icon: UploadCloud, hideForViewer: true },
    { name: 'Templates', path: '/templates', icon: Layers, adminOnly: true },
    { name: 'AI Chat', path: '/chat', icon: MessageSquare },
    { name: 'Hybrid Search', path: '/search', icon: Search },
    { name: 'Team & Roles', path: '/users', icon: Users, adminOnly: true },
    { name: 'Audit Log', path: '/audit', icon: ShieldCheck, adminOnly: true },
    { name: 'Profile', path: '/profile', icon: UserCircle }
  ];

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] transition-colors ${
        liteMode ? 'no-blur' : ''
      }`}
    >
      {/* Top Navigation Bar (Apple iOS 26 Liquid Glass Sticky Header) */}
      <header
        className={`sticky top-0 z-50 w-full border-b border-black/[0.06] dark:border-white/[0.08] transition-colors ${
          liteMode
            ? 'bg-white dark:bg-[#1C1C1E] shadow-sm'
            : 'liquid-glass'
        }`}
        style={{ position: 'sticky', top: 0, zIndex: 50 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Identity */}
          <Link to="/dashboard" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="h-9 w-9 rounded-[10px] bg-[#007AFF] flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-[#007AFF]/25 transition-transform group-hover:scale-105 active:scale-95">
              DM
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#1C1C1E] dark:text-white">
                DocuMind
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] tracking-wider uppercase">
                AI
              </span>
            </div>
          </Link>

          {/* Action Center (Theme, Lite Mode, Organization, User Profile) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-[10px] text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-[#1C1C1E]" />
              )}
            </button>

            {/* Lite Mode Performance Toggle */}
            <button
              type="button"
              onClick={toggleLiteMode}
              title={
                liteMode
                  ? 'Lite Mode is ON (Blur off for max performance)'
                  : 'Switch to Lite Mode (Blur off for performance)'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                liteMode
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-black/5 dark:bg-white/10 text-[#6B7280] dark:text-[#8E8E93] border-transparent hover:bg-black/10 dark:hover:bg-white/15'
              }`}
            >
              <Zap
                className={`h-3.5 w-3.5 ${
                  liteMode ? 'text-amber-500 fill-amber-500' : 'text-[#6B7280] dark:text-[#8E8E93]'
                }`}
              />
              <span className="hidden sm:inline">Lite:</span>
              <span>{liteMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Tenant Indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">
              <Building2 className="h-3.5 w-3.5 text-[#007AFF]" />
              <span className="truncate max-w-[140px]">{organization?.name || 'Workspace'}</span>
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-2 pl-2 border-l border-black/10 dark:border-white/10">
              <Link
                to="/profile"
                title="View Account Profile"
                className="flex items-center gap-2 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-[#007AFF]/15 text-[#007AFF] font-bold text-xs flex items-center justify-center">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'DM'}
                </div>
                <div className="text-left hidden lg:block pr-1">
                  <div className="text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] leading-none mb-0.5">
                    {user?.name}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
                    {user?.role}
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-[#6B7280] dark:text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-[10px] transition-all cursor-pointer active:scale-95"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full flex-1 flex flex-col min-h-0">
        {/* Apple Segmented Navigation Bar */}
        <nav className="flex items-center space-x-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-[14px] mb-4 overflow-x-auto scrollbar-none border border-black/[0.04] dark:border-white/[0.06] shrink-0">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            if (item.hideForViewer && user?.role === 'viewer') return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all shrink-0 cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-white dark:bg-[#1C1C1E] text-[#007AFF] dark:text-[#F2F2F7] shadow-xs font-semibold'
                      : 'text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Dynamic Nested Page Content */}
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
