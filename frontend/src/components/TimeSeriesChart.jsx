import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Thermometer, Clock, AlertCircle } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs">
        <p className="font-semibold text-slate-200 mb-1">{label}</p>
        {data.temperature !== null && data.temperature !== undefined && (
          <p className="text-cyan-400 font-mono">
            Temperature: <span className="font-bold">{data.temperature}°C</span>
          </p>
        )}
        <p className="text-indigo-400 font-mono">
          Cumulative Runtime: <span className="font-bold">{data.runtimeHours} hrs</span>
        </p>
        {data.errorCode && (
          <p className="mt-1 flex items-center gap-1 text-rose-400 font-mono font-semibold">
            <AlertCircle size={12} />
            Error: {data.errorCode}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const TimeSeriesChart = ({ readings = [], assetType = 'HVAC' }) => {
  const [metric, setMetric] = useState('temperature'); // 'temperature' | 'runtimeHours' | 'both'

  const tempThresholds = {
    HVAC: 50,
    Generator: 85,
    Pump: 65,
    Lift: 50,
    Other: 60,
  };
  const maxSafeTemp = tempThresholds[assetType] || 60;

  const formattedData = readings.map((r) => {
    const d = new Date(r.timestamp);
    return {
      rawDate: d,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      fullDate: d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      temperature: r.temperature !== null ? Number(r.temperature) : null,
      runtimeHours: Number(r.runtimeHours),
      errorCode: r.errorCode,
    };
  });

  const hasTemperature = formattedData.some((d) => d.temperature !== null);

  if (formattedData.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400 text-xs">
        No reading history recorded yet. Ingest readings using the tool below.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Telemetry Time-Series
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
            {formattedData.length} data points
          </span>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          {hasTemperature && (
            <button
              onClick={() => setMetric('temperature')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                metric === 'temperature'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer size={13} />
              <span>Temp (°C)</span>
            </button>
          )}
          <button
            onClick={() => setMetric('runtimeHours')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
              metric === 'runtimeHours'
                ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock size={13} />
            <span>Runtime (hrs)</span>
          </button>
        </div>
      </div>

      {/* Recharts chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />

            {metric === 'temperature' && hasTemperature && (
              <>
                <ReferenceLine
                  y={maxSafeTemp}
                  label={{
                    value: `Limit ${maxSafeTemp}°C`,
                    fill: '#f43f5e',
                    fontSize: 10,
                    position: 'top',
                  }}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.errorCode) {
                      return (
                        <circle
                          key={props.key}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#f43f5e"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }
                    if (payload.temperature > maxSafeTemp) {
                      return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#f43f5e" />;
                    }
                    return null;
                  }}
                  activeDot={{ r: 6, fill: '#06b6d4' }}
                />
              </>
            )}

            {metric === 'runtimeHours' && (
              <Line
                type="monotone"
                dataKey="runtimeHours"
                name="Runtime Hours"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: '#6366f1' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & hints */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          {metric === 'temperature' && hasTemperature && (
            <>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Sensor Temperature
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span> Exceeded Limit / Error Code
              </span>
            </>
          )}
          {metric === 'runtimeHours' && (
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-400"></span> Cumulative Runtime Hours
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-slate-500">Sorted timestamp ascending</span>
      </div>
    </div>
  );
};
