import React, { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { TimeSeriesChart } from './TimeSeriesChart';
import {
  X,
  Sparkles,
  RefreshCw,
  Clock,
  Calendar,
  MapPin,
  Plus,
  FileText,
  Activity,
  AlertOctagon,
  CheckCircle2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import api from '../api/client';

export const AssetDetailModal = ({ asset, onClose, onAssetUpdated }) => {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'readings' | 'logs'
  const [readings, setReadings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // New Reading form state
  const [showAddReading, setShowAddReading] = useState(false);
  const [newReading, setNewReading] = useState({
    temperature: '',
    runtimeHours: '',
    errorCode: '',
  });
  const [submittingReading, setSubmittingReading] = useState(false);

  // New Log form state
  const [showAddLog, setShowAddLog] = useState(false);
  const [logDescription, setLogDescription] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  useEffect(() => {
    if (asset?._id) {
      fetchAssetData();
    }
  }, [asset?._id]);

  const fetchAssetData = async () => {
    setLoading(true);
    try {
      const [readingsRes, logsRes, statusRes] = await Promise.all([
        api.get(`/assets/${asset._id}/readings`),
        api.get(`/assets/${asset._id}/logs`),
        api.get(`/assets/${asset._id}/status`),
      ]);
      setReadings(readingsRes.data.data || []);
      setLogs(logsRes.data.data || []);
      setStatusInfo(statusRes.data || null);

      // Pre-fill next runtime estimate
      if (readingsRes.data.data?.length > 0) {
        const latest = readingsRes.data.data[readingsRes.data.data.length - 1];
        setNewReading((prev) => ({
          ...prev,
          runtimeHours: Math.round((latest.runtimeHours + 8) * 10) / 10,
        }));
      }
    } catch (err) {
      console.error('Error fetching asset details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post(`/assets/${asset._id}/analyze`);
      setStatusInfo((prev) => ({
        ...prev,
        status: res.data.data.status,
        recommendation: res.data.data.summary,
      }));
      if (onAssetUpdated) onAssetUpdated();
      await fetchAssetData();
    } catch (err) {
      alert('Analysis error: ' + (err.response?.data?.message || err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddReadingSubmit = async (e) => {
    e.preventDefault();
    if (!newReading.runtimeHours) {
      alert('Runtime hours is required');
      return;
    }

    setSubmittingReading(true);
    try {
      await api.post(`/assets/${asset._id}/readings`, {
        timestamp: new Date().toISOString(),
        runtimeHours: Number(newReading.runtimeHours),
        temperature: newReading.temperature !== '' ? Number(newReading.temperature) : null,
        errorCode: newReading.errorCode ? newReading.errorCode.trim() : null,
      });

      setShowAddReading(false);
      setNewReading({ temperature: '', runtimeHours: '', errorCode: '' });
      await fetchAssetData();
      if (onAssetUpdated) onAssetUpdated();
    } catch (err) {
      alert('Ingestion error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingReading(false);
    }
  };

  const handleAddLogSubmit = async (e) => {
    e.preventDefault();
    if (!logDescription.trim()) return;

    setSubmittingLog(true);
    try {
      await api.post(`/assets/${asset._id}/logs`, {
        description: logDescription.trim(),
        type: 'manual-entry',
      });
      setLogDescription('');
      setShowAddLog(false);
      const logsRes = await api.get(`/assets/${asset._id}/logs`);
      setLogs(logsRes.data.data || []);
    } catch (err) {
      alert('Log error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingLog(false);
    }
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 p-5 sm:p-6 bg-slate-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {asset.type}
              </span>
              <span className="text-slate-600">•</span>
              <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                {asset.department} Department
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{asset.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-slate-500" />
                {asset.location?.building || 'Main Facility'}, {asset.location?.zone || 'Zone A'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-slate-500" />
                Interval: {asset.maintenanceIntervalDays} days
              </span>
              {asset.lastServicedDate && (
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-slate-500" />
                  Last Serviced: {new Date(asset.lastServicedDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={statusInfo?.status || asset.status} size="lg" />
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* AI Health Status & Plain-Language Recommendation Banner */}
        <div className="border-b border-slate-800/80 bg-slate-950/40 p-5 sm:p-6">
          <div
            className={`rounded-2xl border p-4 transition-all ${
              (statusInfo?.status || asset.status) === 'Critical'
                ? 'border-rose-500/30 bg-rose-950/25 text-rose-200 shadow-lg shadow-rose-950/30'
                : (statusInfo?.status || asset.status) === 'Watch'
                ? 'border-amber-500/30 bg-amber-950/25 text-amber-200 shadow-lg shadow-amber-950/30'
                : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Sparkles
                  size={17}
                  className={
                    (statusInfo?.status || asset.status) === 'Critical'
                      ? 'text-rose-400'
                      : (statusInfo?.status || asset.status) === 'Watch'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }
                />
                <span>AI Governance & Explainability Report</span>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw size={13} className={analyzing ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
                <span>{analyzing ? 'Running Analysis...' : 'Re-Analyze Signals'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed font-medium">
              {statusInfo?.recommendation || `${asset.name} status is ${asset.status}.`}
            </p>

            {/* Reasons tags */}
            {statusInfo?.activeAlert?.reasons && statusInfo.activeAlert.reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/40">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Triggered Rules:
                </span>
                {statusInfo.activeAlert.reasons.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-300 border border-slate-700/60"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 pt-3 bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'telemetry'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity size={14} />
              <span>Telemetry & Trend</span>
            </button>
            <button
              onClick={() => setActiveTab('readings')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'readings'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock size={14} />
              <span>Readings Log ({readings.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={14} />
              <span>Audit Trail ({logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddReading(!showAddReading)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              <Plus size={13} />
              <span>Ingest Reading</span>
            </button>
            <button
              onClick={() => setShowAddLog(!showAddLog)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <FileText size={13} />
              <span>Add Log</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* Add Reading Ingestion Form Drawer */}
          {showAddReading && (
            <form
              onSubmit={handleAddReadingSubmit}
              className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Ingest Live Sensor Reading
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddReading(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Cumulative Runtime Hours *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newReading.runtimeHours}
                    onChange={(e) =>
                      setNewReading({ ...newReading, runtimeHours: e.target.value })
                    }
                    placeholder="e.g. 1540.5"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newReading.temperature}
                    onChange={(e) =>
                      setNewReading({ ...newReading, temperature: e.target.value })
                    }
                    placeholder="e.g. 42.5"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Error Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newReading.errorCode}
                    onChange={(e) =>
                      setNewReading({ ...newReading, errorCode: e.target.value })
                    }
                    placeholder="e.g. ERR_OVERHEAT_01"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddReading(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReading}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{submittingReading ? 'Ingesting & Analyzing...' : 'Submit Reading'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Add Manual Maintenance Log Form Drawer */}
          {showAddLog && (
            <form
              onSubmit={handleAddLogSubmit}
              className="mb-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Record Manual Maintenance Action
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X size={15} />
                </button>
              </div>

              <div>
                <textarea
                  rows={2}
                  required
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  placeholder="Describe inspection, parts replaced, or servicing performed..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{submittingLog ? 'Saving...' : 'Save Log Entry'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 1: Telemetry Time Series */}
          {activeTab === 'telemetry' && (
            <TimeSeriesChart readings={readings} assetType={asset.type} />
          )}

          {/* Tab 2: Readings Log Table */}
          {activeTab === 'readings' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Runtime Hours</th>
                      <th className="px-4 py-3 font-semibold">Temperature</th>
                      <th className="px-4 py-3 font-semibold">Error Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {[...readings].reverse().map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono text-slate-300">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium text-indigo-300">
                          {r.runtimeHours} hrs
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {r.temperature !== null && r.temperature !== undefined ? (
                            <span
                              className={
                                r.temperature > 50 ? 'text-rose-400 font-bold' : 'text-cyan-400'
                              }
                            >
                              {r.temperature}°C
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {r.errorCode ? (
                            <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400 border border-rose-500/30">
                              {r.errorCode}
                            </span>
                          ) : (
                            <span className="text-slate-600">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Maintenance Audit Trail */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                  No maintenance records found for this asset.
                </div>
              ) : (
                logs.map((log) => {
                  const isAiFlag = log.type === 'ai-flag';
                  const isResolution = log.type === 'resolution';

                  return (
                    <div
                      key={log._id}
                      className={`flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                        isAiFlag
                          ? 'border-amber-500/30 bg-amber-950/20'
                          : isResolution
                          ? 'border-emerald-500/30 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          isAiFlag
                            ? 'bg-amber-500/20 text-amber-400'
                            : isResolution
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                      >
                        {isAiFlag ? (
                          <AlertTriangle size={15} />
                        ) : isResolution ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <FileText size={15} />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isAiFlag
                                ? 'bg-amber-500/20 text-amber-300'
                                : isResolution
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                          {log.description}
                        </p>

                        <div className="mt-2 text-[11px] text-slate-400">
                          {log.loggedBy ? (
                            <span>
                              Logged by: <span className="font-semibold text-slate-300">{log.loggedBy.name}</span>{' '}
                              ({log.loggedBy.role})
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">System-generated by AI Decision Layer</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
