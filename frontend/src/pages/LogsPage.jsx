import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle2, Clock, User, Layers } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const LogsPage = () => {
  const { user, isDepartmentStaff } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [selectedType]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch active assets first to get their logs
      const assetsRes = await api.get('/assets');
      const assets = assetsRes.data.data || [];

      // Collect logs across all assets
      const logPromises = assets.map((a) =>
        api
          .get(`/assets/${a._id}/logs`)
          .then((res) =>
            res.data.data.map((l) => ({
              ...l,
              assetName: a.name,
              assetType: a.type,
              department: a.department,
            }))
          )
          .catch(() => [])
      );

      const allLogsNested = await Promise.all(logPromises);
      let combinedLogs = allLogsNested.flat();

      // Sort chronological descending
      combinedLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (selectedType) {
        combinedLogs = combinedLogs.filter((l) => l.type === selectedType);
      }

      setLogs(combinedLogs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Maintenance Operations Audit Trail</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete tamper-evident log of AI flags, staff interventions, and alert resolutions
          </p>
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All Log Types</option>
          <option value="ai-flag">AI Flags</option>
          <option value="manual-entry">Manual Entries</option>
          <option value="resolution">Resolutions</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 animate-pulse">
          Loading audit trail history...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400">
          No maintenance log entries found.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, idx) => {
            const isAiFlag = log.type === 'ai-flag';
            const isResolution = log.type === 'resolution';

            return (
              <div
                key={log._id || idx}
                className={`flex items-start gap-4 rounded-2xl border p-4 transition-all ${
                  isAiFlag
                    ? 'border-amber-500/20 bg-amber-950/15'
                    : isResolution
                    ? 'border-emerald-500/20 bg-emerald-950/15'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isAiFlag
                      ? 'bg-amber-500/20 text-amber-400'
                      : isResolution
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-indigo-500/20 text-indigo-400'
                  }`}
                >
                  {isAiFlag ? (
                    <AlertTriangle size={16} />
                  ) : isResolution ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <FileText size={16} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{log.assetName}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {log.department}
                      </span>
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
                    </div>

                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                    {log.description}
                  </p>

                  <div className="mt-2 text-[11px] text-slate-400">
                    {log.loggedBy ? (
                      <span>
                        Recorded by: <span className="font-semibold text-slate-300">{log.loggedBy.name}</span>{' '}
                        ({log.loggedBy.role})
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">System-generated by AI Decision Layer</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
