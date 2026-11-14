import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  Layers,
  MessageSquare,
  FileCheck,
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

  // Lite Mode (switches blur off for maximum responsiveness on laptops)
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
    { name: 'Upload Documents', path: '/upload', icon: UploadCloud, hideForViewer: true },
    { name: 'Templates', path: '/templates', icon: Layers, adminOnly: true },
    { name: 'AI Chat', path: '/chat', icon: MessageSquare },
    { name: 'Hybrid Search', path: '/search', icon: Search },
    { name: 'Team & Roles', path: '/users', icon: Users, adminOnly: true },
    { name: 'Audit Log', path: '/audit', icon: ShieldCheck, adminOnly: true },
    { name: 'Profile & Security', path: '/profile', icon: UserCircle },
  ];

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors ${liteMode ? 'no-blur' : ''}`}>
      {/* Top Navbar */}
      <header
        className={`sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 transition-colors ${
          liteMode ? 'bg-white dark:bg-slate-900 shadow-sm' : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-200 dark:shadow-indigo-900/30">
              DM
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">DocuMind</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                MVP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            {/* Lite Mode Toggle */}
            <button
              onClick={toggleLiteMode}
              title={liteMode ? 'Switch to Standard Glass UI' : 'Switch to Lite Mode (Blur Off for Performance)'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                liteMode
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Zap className={`h-3 w-3 ${liteMode ? 'text-amber-600 dark:text-amber-400 fill-amber-500' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Lite:</span>
              <span className="font-bold">{liteMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Tenant indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>{organization?.name || 'Workspace'}</span>
            </div>

            {/* User profile & role badge */}
            <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-3 sm:pl-4">
              <Link
                to="/profile"
                title="View Account Profile & Role"
                className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {user?.name}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {user?.role}
                  </div>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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
        <nav className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 overflow-x-auto">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            if (item.hideForViewer && user?.role === 'viewer') return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
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

