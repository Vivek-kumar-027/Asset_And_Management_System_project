import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Lock, Mail, ArrowRight, Shield, Sparkles } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      {/* Background glow accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-10 right-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl"></div>

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-xl shadow-cyan-900/30 mb-4">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            AssetOps <span className="text-cyan-400">Decision Layer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            AI-Driven Governance & Health Operations Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@ops.local"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 hover:from-cyan-500 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Quick Fill Demo Credentials */}
          <div className="mt-6 border-t border-slate-800/80 pt-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <Sparkles size={12} className="text-cyan-400" />
              <span>Demo Persona Quick-Select</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@ops.local', 'Admin@12345')}
                className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-2.5 hover:border-amber-500/40 hover:bg-amber-950/30 transition-colors"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <Shield size={11} />
                  <span>Admin</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">admin@ops.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('electrical@ops.local', 'Staff@12345')}
                className="rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-2.5 hover:border-cyan-500/40 hover:bg-cyan-950/30 transition-colors"
              >
                <div className="text-[11px] font-bold text-cyan-400">Electrical Staff</div>
                <div className="text-[10px] text-slate-400 truncate">electrical@ops.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('hvac@ops.local', 'Staff@12345')}
                className="rounded-xl border border-indigo-500/20 bg-indigo-950/15 p-2.5 hover:border-indigo-500/40 hover:bg-indigo-950/30 transition-colors"
              >
                <div className="text-[11px] font-bold text-indigo-400">HVAC Staff</div>
                <div className="text-[10px] text-slate-400 truncate">hvac@ops.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('plumbing@ops.local', 'Staff@12345')}
                className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-2.5 hover:border-emerald-500/40 hover:bg-emerald-950/30 transition-colors"
              >
                <div className="text-[11px] font-bold text-emerald-400">Plumbing Staff</div>
                <div className="text-[10px] text-slate-400 truncate">plumbing@ops.local</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
