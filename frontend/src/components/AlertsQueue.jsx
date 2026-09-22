import React, { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  UserCheck,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Send,
  X,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AlertsQueue = ({ onAlertResolved }) => {
  const { user, isDepartmentStaff } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('active'); // 'active' | 'resolved'
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Resolution modal state
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [viewTab, departmentFilter, statusFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewTab === 'active') params.resolved = 'false';
      if (viewTab === 'resolved') params.resolved = 'true';
      if (departmentFilter && !isDepartmentStaff) params.department = departmentFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/alerts', { params });
      setAlerts(res.data.data || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await api.patch(`/alerts/${alertId}/acknowledge`);
      await fetchAlerts();
    } catch (err) {
      alert('Acknowledge failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      alert('A non-empty resolution note is required.');
      return;
    }

    setSubmittingResolution(true);
    try {
      await api.patch(`/alerts/${resolvingAlert._id}/resolve`, {
        resolutionNote: resolutionNote.trim(),
      });
      setResolvingAlert(null);
      setResolutionNote('');
      await fetchAlerts();
      if (onAlertResolved) onAlertResolved();
    } catch (err) {
      alert('Resolve failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingResolution(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls & tabs */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Department Alert Routing Queue</h2>
            {isDepartmentStaff && (
              <span className="rounded-lg bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                {user?.department} Queue
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated triaged incidents routed directly from the AI Decision Layer
          </p>
        </div>

        {/* View toggle (Active vs Resolved) */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setViewTab('active')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewTab === 'active'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active Incidents
          </button>
          <button
            onClick={() => setViewTab('resolved')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewTab === 'resolved'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resolution History
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {!isDepartmentStaff && (
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {['Electrical', 'HVAC', 'Plumbing', 'IT', 'General'].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Watch">Watch</option>
        </select>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 animate-pulse">
          Loading department alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-200">Queue is Clear</h3>
          <p className="text-xs text-slate-400 mt-1">
            {viewTab === 'active'
              ? 'No unresolved alerts matching your queue filters.'
              : 'No resolved incidents recorded.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {alerts.map((alert) => {
            const isCritical = alert.status === 'Critical';

            return (
              <div
                key={alert._id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  alert.resolved
                    ? 'border-slate-800 bg-slate-900/40 opacity-80'
                    : isCritical
                    ? 'border-rose-500/40 bg-rose-950/20 shadow-lg shadow-rose-950/40'
                    : 'border-amber-500/40 bg-amber-950/20 shadow-lg shadow-amber-950/40'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={alert.status} size="md" />
                      <span className="text-sm font-bold text-white">
                        {alert.assetId?.name || 'Asset'}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-slate-700">
                        {alert.assetId?.department || 'Department'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Clock size={13} className="text-slate-500" />
                      <span>Triggered: {new Date(alert.triggeredAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm font-medium text-slate-200 mt-2 leading-relaxed">
                    {alert.summary}
                  </p>

                  {/* Rule reasons */}
                  {alert.reasons && alert.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Triggered Rules:
                      </span>
                      {alert.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-300 border border-slate-800"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Acknowledged / Resolved status metadata */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                    {alert.acknowledged ? (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <UserCheck size={13} />
                        Acknowledged
                        {alert.acknowledgedBy && ` by ${alert.acknowledgedBy.name}`}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 italic">
                        Unacknowledged
                      </span>
                    )}

                    {alert.resolved && (
                      <div className="w-full mt-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3 text-emerald-200">
                        <div className="flex items-center gap-1 font-semibold text-xs mb-1">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span>Resolved at {new Date(alert.resolvedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs italic text-emerald-300/90">
                          "{alert.resolutionNote}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons for unresolved alerts */}
                {!alert.resolved && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800/80 pt-3">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert._id)}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    <button
                      onClick={() => setResolvingAlert(alert)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-950"
                    >
                      <CheckCircle2 size={14} />
                      <span>Resolve Alert</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleResolveSubmit}
            className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Resolve Alert Incident</h3>
                <p className="text-xs text-slate-400">
                  {resolvingAlert.assetId?.name} — {resolvingAlert.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Resolution Note (Required per Spec) *
              </label>
              <textarea
                rows={3}
                required
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Explain the corrective action taken, inspection result, or parts replaced..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This note will be automatically committed to the permanent maintenance audit trail.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingResolution}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>{submittingResolution ? 'Resolving...' : 'Confirm Resolution'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
