import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/library';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0_0_0_/_0.06)] dark:shadow-[0_8px_30px_rgb(0_0_0_/_0.5)] rounded-[24px] p-7 sm:p-8">
          {/* Apple ID Style Minimal Header */}
          <div className="text-center mb-7">
            <div className="inline-flex h-12 w-12 rounded-[14px] bg-[#007AFF] text-white items-center justify-center font-bold text-lg mb-3 shadow-sm shadow-[#007AFF]/30">
              DM
            </div>
            <h1 className="text-xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
              Sign in to DocuMind
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1">
              Intelligent Document Processing Platform
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#8E8E93]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 rounded-[12px] text-sm text-[#1C1C1E] dark:text-[#F2F2F7] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#8E8E93]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 rounded-[12px] text-sm text-[#1C1C1E] dark:text-[#F2F2F7] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] active:scale-[0.97] text-white font-medium text-sm rounded-[12px] transition-all shadow-sm shadow-[#007AFF]/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-7 text-center pt-5 border-t border-black/5 dark:border-white/10">
            <p className="text-xs text-[#6B7280] dark:text-[#8E8E93]">
              Need a new workspace?{' '}
              <Link
                to="/register"
                className="text-[#007AFF] hover:underline font-semibold"
              >
                Register Organization
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
