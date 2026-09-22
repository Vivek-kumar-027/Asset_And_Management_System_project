import React from 'react';
import { StatusBadge } from './StatusBadge';
import {
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  ChevronRight,
  PlusCircle,
  Trash2,
  Cpu,
  Zap,
  Flame,
  Droplets,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AssetCard = ({ asset, onSelect, onAddReading, onDeactivate }) => {
  const { isAdmin } = useAuth();

  // Type icon mapping
  const getTypeIcon = (type) => {
    switch (type) {
      case 'Generator':
        return Zap;
      case 'HVAC':
        return Flame;
      case 'Pump':
        return Droplets;
      case 'Lift':
        return ArrowUpRight;
      default:
        return Cpu;
    }
  };

  const TypeIcon = getTypeIcon(asset.type);

  // Maintenance interval calculations
  const now = new Date();
  const lastServiced = asset.lastServicedDate ? new Date(asset.lastServicedDate) : new Date(asset.installedDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceService = Math.floor((now - lastServiced) / msPerDay);
  const daysRemaining = asset.maintenanceIntervalDays - daysSinceService;
  const isOverdue = daysRemaining < 0;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-slate-950/60">
      <div>
        {/* Card Header: Type, Department, Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-cyan-400 group-hover:bg-cyan-500/10 group-hover:text-cyan-300 transition-colors">
              <TypeIcon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {asset.type}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[10px] font-semibold text-indigo-400">
                  {asset.department}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                {asset.name}
              </h3>
            </div>
          </div>
          <StatusBadge status={asset.status} size="sm" />
        </div>

        {/* Location & schedule details */}
        <div className="space-y-1.5 py-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-500 shrink-0" />
            <span className="truncate">
              {asset.location?.building || 'Main Facility'}, {asset.location?.zone || 'Zone A'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar size={12} />
              Interval: {asset.maintenanceIntervalDays}d
            </span>
            <span
              className={`font-mono font-medium ${
                isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'
              }`}
            >
              {isOverdue ? `${Math.abs(daysRemaining)}d OVERDUE` : `${daysRemaining}d until service`}
            </span>
          </div>
        </div>

        {/* AI Health Summary Highlight if Watch/Critical */}
        {asset.status !== 'Healthy' && (
          <div className={`mt-3 rounded-xl p-2.5 text-[11px] border ${
            asset.status === 'Critical'
              ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
          }`}>
            <div className="flex items-center gap-1 font-semibold mb-0.5">
              <Sparkles size={12} className={asset.status === 'Critical' ? 'text-rose-400' : 'text-amber-400'} />
              <span>AI Decision Layer</span>
            </div>
            <p className="line-clamp-2 leading-relaxed opacity-90">
              Attention required: abnormal signals or overdue maintenance detected.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
        <div className="flex items-center gap-1.5">
          {onAddReading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddReading(asset);
              }}
              title="Ingest new reading"
              className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <PlusCircle size={12} />
              <span>Add Reading</span>
            </button>
          )}

          {isAdmin && onDeactivate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Deactivate ${asset.name}? It will be soft-deleted from default views.`)) {
                  onDeactivate(asset._id);
                }
              }}
              title="Deactivate asset"
              className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <button
          onClick={() => onSelect(asset)}
          className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <span>View Telemetry</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
