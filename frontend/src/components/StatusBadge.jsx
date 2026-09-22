import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export const StatusBadge = ({ status = 'Healthy', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  if (status === 'Critical') {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-sm shadow-rose-950/50 ${sizeClasses[size]} ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
        </span>
        <AlertOctagon size={iconSizes[size]} className="text-rose-400" />
        <span>Critical</span>
      </span>
    );
  }

  if (status === 'Watch') {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-950/50 ${sizeClasses[size]} ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-amber-400"></span>
        <AlertTriangle size={iconSizes[size]} className="text-amber-400" />
        <span>Watch</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-950/50 ${sizeClasses[size]} ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
      <CheckCircle2 size={iconSizes[size]} className="text-emerald-400" />
      <span>Healthy</span>
    </span>
  );
};
