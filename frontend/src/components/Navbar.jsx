import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Layers,
  Bell,
  FileText,
  LogOut,
  Sparkles,
  Shield,
  Briefcase,
  Plus,
} from 'lucide-react';
import api from '../api/client';

export const Navbar = ({ activeTab, setActiveTab, activeAlertsCount = 0, onRefreshData, onOpenCreateAsset }) => {
  const { user, logout, isAdmin } = useAuth();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (confirm('This will seed the database with 35+ days of sample historical readings and varied asset scenarios. Proceed?')) {
      setSeeding(true);
      try {
        await api.post('/assets/seed');
        if (onRefreshData) onRefreshData();
      } catch (err) {
        alert('Seed error: ' + (err.response?.data?.message || err.message));
      } finally {
        setSeeding(false);
      }
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'assets', label: 'Assets', icon: Layers },
    {
      id: 'alerts',
      label: 'Alerts Queue',
      icon: Bell,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
    { id: 'logs', label: 'Audit Trail', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-900/30">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">AssetOps</span>
              <span className="rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                AI DECISION LAYER
              </span>
            </div>
            <p className="text-xs text-slate-400">Facility Health & Governance</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/80 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/40 px-1 text-[11px] font-bold text-rose-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side tools & user */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Seed Dev Data Button */}
          <button
            onClick={handleSeed}
            disabled={seeding}
            title="Seed 35+ days of sample readings and realistic scenarios"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20 hover:border-indigo-500/50 disabled:opacity-50"
          >
            <Sparkles size={13} className={seeding ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
            <span className="hidden lg:inline">{seeding ? 'Seeding...' : 'Seed Demo Data'}</span>
          </button>

          {/* Admin Create Asset Button */}
          {isAdmin && onOpenCreateAsset && (
            <button
              onClick={onOpenCreateAsset}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-cyan-900/50 transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add Asset</span>
            </button>
          )}

          {/* User profile capsule */}
          <div className="flex items-center gap-2 border-l border-slate-800 pl-2 sm:pl-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-200">{user?.name}</div>
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    user?.role === 'Admin' ? 'text-amber-400' : 'text-cyan-400'
                  }`}
                >
                  {user?.role === 'Admin' ? <Shield size={10} /> : <Briefcase size={10} />}
                  {user?.role}
                </span>
                {user?.department && (
                  <span className="rounded bg-slate-800 px-1 py-0.2 text-[10px] text-slate-400 font-mono">
                    {user.department}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden border-t border-slate-800/80 bg-slate-900/90 px-2 py-1 justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded text-[11px] ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
