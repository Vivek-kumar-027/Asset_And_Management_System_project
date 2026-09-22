import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, AlertOctagon, Bell } from 'lucide-react';

export const MetricCards = ({ summary, selectedStatus, onSelectStatus }) => {
  const byStatus = summary?.byStatus || { Healthy: 0, Watch: 0, Critical: 0 };
  const totalAssets = summary?.totalAssets || 0;
  const activeAlerts = summary?.activeAlerts || 0;

  const cards = [
    {
      id: 'all',
      statusKey: '',
      title: 'Monitored Assets',
      count: totalAssets,
      subtitle: 'Total registered units',
      icon: Layers,
      textColor: 'text-slate-100',
      borderColor: 'border-slate-800',
      activeBorder: 'ring-2 ring-cyan-500 border-transparent',
      bgColor: 'bg-slate-900/60',
      accentColor: 'text-cyan-400',
    },
    {
      id: 'healthy',
      statusKey: 'Healthy',
      title: 'Healthy Status',
      count: byStatus.Healthy,
      subtitle: 'Normal baseline operation',
      icon: CheckCircle2,
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
      activeBorder: 'ring-2 ring-emerald-500 border-transparent',
      bgColor: 'bg-emerald-950/20',
      accentColor: 'text-emerald-400',
    },
    {
      id: 'watch',
      statusKey: 'Watch',
      title: 'Watch Status',
      count: byStatus.Watch,
      subtitle: 'Deviations or overdue',
      icon: AlertTriangle,
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
      activeBorder: 'ring-2 ring-amber-500 border-transparent',
      bgColor: 'bg-amber-950/20',
      accentColor: 'text-amber-400',
    },
    {
      id: 'critical',
      statusKey: 'Critical',
      title: 'Critical Status',
      count: byStatus.Critical,
      subtitle: 'Immediate action needed',
      icon: AlertOctagon,
      textColor: 'text-rose-400',
      borderColor: 'border-rose-500/20',
      activeBorder: 'ring-2 ring-rose-500 border-transparent',
      bgColor: 'bg-rose-950/20',
      accentColor: 'text-rose-400',
    },
    {
      id: 'alerts',
      statusKey: null,
      title: 'Active Alerts',
      count: activeAlerts,
      subtitle: 'Unresolved department alerts',
      icon: Bell,
      textColor: activeAlerts > 0 ? 'text-rose-400' : 'text-slate-300',
      borderColor: activeAlerts > 0 ? 'border-rose-500/30' : 'border-slate-800',
      activeBorder: 'ring-2 ring-indigo-500 border-transparent',
      bgColor: activeAlerts > 0 ? 'bg-rose-950/20' : 'bg-slate-900/60',
      accentColor: 'text-rose-400',
      isAlertsCard: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = !c.isAlertsCard && selectedStatus === c.statusKey;
        return (
          <button
            key={c.id}
            onClick={() => {
              if (!c.isAlertsCard && onSelectStatus) {
                onSelectStatus(isSelected ? '' : c.statusKey);
              }
            }}
            className={`flex flex-col text-left rounded-2xl p-4 transition-all duration-200 border ${
              c.borderColor
            } ${c.bgColor} ${
              isSelected ? c.activeBorder : 'hover:border-slate-700 hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.title}</span>
              <Icon size={18} className={c.accentColor} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${c.textColor}`}>
                {c.count}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">{c.subtitle}</p>
          </button>
        );
      })}
    </div>
  );
};
