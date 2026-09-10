import React, { useState } from 'react';
import { X, Activity, Radio, Cpu, CheckCircle2, RefreshCw, Zap, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { GatewayMetrics, RequestLog } from '../types';
import { playTerminalBlip } from '../utils/sound';

interface MetricsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: GatewayMetrics;
  requestLogs: RequestLog[];
  isStreaming: boolean;
  onToggleStreaming: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  isOpen,
  onClose,
  metrics,
  requestLogs,
  isStreaming,
  onToggleStreaming,
}) => {
  const [activeMetricTab, setActiveMetricTab] = useState<'rps' | 'tokens' | 'latency'>('rps');

  if (!isOpen) return null;

  // Generate SVG path for sparkline
  const renderSparkline = (data: number[], strokeColor: string, fillColor: string) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data) * 1.15;
    const min = Math.min(...data) * 0.85;
    const range = max - min || 1;
    const width = 540;
    const height = 140;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 20) - 10;
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;
    const areaData = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        <defs>
          <linearGradient id={`grad-${strokeColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <line x1="0" y1="70" x2={width} y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <line x1="0" y1="120" x2={width} y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

        <path d={areaData} fill={`url(#grad-${strokeColor})`} />
        <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Glowing pulse on latest point */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].split(',')[0]}
            cy={points[points.length - 1].split(',')[1]}
            r="4.5"
            fill={strokeColor}
            className="animate-ping"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-[#07090f] border border-cyan-500/30 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d121c] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Mars Neural Telemetry & Metrics
              </h2>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed · Planetary Gateway Sol 782
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playTerminalBlip(700);
                onToggleStreaming();
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 transition-colors ${
                isStreaming
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
              <span>{isStreaming ? 'Live Stream Active' : 'Stream Paused'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>THROUGHPUT</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {metrics.currentRps.toFixed(1)} <span className="text-xs font-normal text-slate-400 font-sans">RPS</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1">
                Peak: {metrics.peakRps.toFixed(1)} RPS
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>AVG EDGE LATENCY</span>
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {metrics.avgLatencyMs.toFixed(1)} <span className="text-xs font-normal text-slate-400 font-sans">ms</span>
              </div>
              <div className="text-[11px] text-cyan-400 font-mono mt-1">
                P99: {metrics.p99LatencyMs.toFixed(1)} ms
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>TOTAL INFERENCES</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {(metrics.totalRequestsToday / 1_000_000).toFixed(2)}M
              </div>
              <div className="text-[11px] text-amber-400 font-mono mt-1">
                {(metrics.totalTokensToday / 1_000_000).toFixed(0)}M Tokens Today
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>EARTH-MARS RELAY</span>
                <Radio className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                ~{metrics.earthMarsDelayMinutes} <span className="text-xs font-normal text-slate-400 font-sans">min delay</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Error Rate: {(metrics.errorRate * 100).toFixed(3)}%
              </div>
            </div>
          </div>

          {/* Real-time Streaming Graph Container */}
          <div className="p-5 rounded-2xl bg-[#0b0e17] border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Real-Time Waveform Telemetry
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Streaming 1-second interval rolling telemetry window
                </p>
              </div>

              {/* Metric tab pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
                <button
                  onClick={() => {
                    playTerminalBlip(600);
                    setActiveMetricTab('rps');
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    activeMetricTab === 'rps' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  RPS ({metrics.currentRps.toFixed(0)})
                </button>
                <button
                  onClick={() => {
                    playTerminalBlip(650);
                    setActiveMetricTab('tokens');
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    activeMetricTab === 'tokens' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tokens/s
                </button>
                <button
                  onClick={() => {
                    playTerminalBlip(700);
                    setActiveMetricTab('latency');
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    activeMetricTab === 'latency' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Latency (ms)
                </button>
              </div>
            </div>

            {/* Sparkline render */}
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              {activeMetricTab === 'rps' && renderSparkline(metrics.rpsHistory, '#06b6d4', '#06b6d4')}
              {activeMetricTab === 'tokens' && renderSparkline(metrics.tokenThroughputHistory, '#f59e0b', '#f59e0b')}
              {activeMetricTab === 'latency' && renderSparkline(metrics.latencyHistory, '#10b981', '#10b981')}
            </div>
          </div>

          {/* Live Request Log Stream Table */}
          <div className="p-5 rounded-2xl bg-[#0b0e17] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Live Inbound Request Stream
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Showing last {requestLogs.length} events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Origin Unit</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requestLogs.map((req) => (
                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{req.timestamp}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                          {req.status} OK
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-sans font-medium">{req.origin}</td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[200px]">{req.endpoint}</td>
                      <td className="py-2.5 px-3 text-amber-300/90">{req.model}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{req.latencyMs.toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{req.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
