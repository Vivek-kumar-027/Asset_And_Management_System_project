import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsQueue } from './components/AlertsQueue';
import { LogsPage } from './pages/LogsPage';
import { Navbar } from './components/Navbar';
import { AssetFormModal } from './components/AssetFormModal';
import api from './api/client';
import { Activity, ShieldCheck, Database, Cpu } from 'lucide-react';

export function App() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [isCreateAssetOpen, setIsCreateAssetOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSummary();
    }
  }, [isAuthenticated]);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.data);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-500"></div>
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Initializing Operations Dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertsCount={summary?.activeAlerts || 0}
        onRefreshData={() => {
          fetchSummary();
        }}
        onOpenCreateAsset={() => setIsCreateAssetOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <DashboardPage
            summary={summary}
            onRefreshSummary={fetchSummary}
            onOpenCreateAsset={() => setIsCreateAssetOpen(true)}
          />
        )}

        {activeTab === 'assets' && (
          <DashboardPage
            summary={summary}
            onRefreshSummary={fetchSummary}
            onOpenCreateAsset={() => setIsCreateAssetOpen(true)}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsQueue
            onAlertResolved={() => {
              fetchSummary();
            }}
          />
        )}

        {activeTab === 'logs' && <LogsPage />}
      </main>

      {/* Asset Creation Modal (Admin only) */}
      <AssetFormModal
        isOpen={isCreateAssetOpen}
        onClose={() => setIsCreateAssetOpen(false)}
        onAssetSaved={() => {
          fetchSummary();
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>AI Decision Microservice Operational</span>
            <span className="text-slate-700">•</span>
            <span>Node.js API Active</span>
            <span className="text-slate-700">•</span>
            <span>MongoDB Connected</span>
          </div>
          <div className="flex items-center gap-3">
            <span>FastAPI Rules Engine v1.0</span>
            <span>JWT Role-Based Access Enforced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
