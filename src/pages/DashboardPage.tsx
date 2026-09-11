import React, { useState } from 'react';
import { Activity, Radio, Cpu, RefreshCw, Zap, TrendingUp, Clock, AlertTriangle, Key, ShieldCheck, Layers } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { motion } from 'motion/react';
import { ApiKeysTab } from '../components/dashboard/ApiKeysTab';
import { SecurityTab } from '../components/dashboard/SecurityTab';
import { VaultAuditTab } from '../components/dashboard/VaultAuditTab';

export function DashboardPage({
  metrics,
  requestLogs,
  isStreaming,
  setIsStreaming,
  keys,
  handleOpenPlayground,
  setIsTerminalOpen,
  onLogout,
}: any) {
  const [activeMetricTab, setActiveMetricTab] = useState<'rps' | 'tokens' | 'latency'>('rps');
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'security' | 'vault'>('overview');

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
        <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <line x1="0" y1="70" x2={width} y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <line x1="0" y1="120" x2={width} y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <path d={areaData} fill={`url(#grad-${strokeColor})`} />
        <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex-1 w-full max-w-6xl mx-auto flex flex-col p-6 overflow-y-auto">
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2 font-display drop-shadow-md">
              Mission Control Dashboard
            </h2>
            <p className="text-sm text-slate-400 font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Feed · Planetary Gateway Sol 782
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
          {([
            ['overview', 'Overview'],
            ['keys', 'API Keys'],
            ['security', 'Security'],
            ['vault', 'Vault & Audit'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { playTerminalBlip(600); setActiveTab(id); }}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === id ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              {id === 'keys' && <Key className="w-3.5 h-3.5" />}
              {id === 'security' && <ShieldCheck className="w-3.5 h-3.5" />}
              {id === 'vault' && <Layers className="w-3.5 h-3.5" />}
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            playTerminalBlip(700);
            setIsStreaming(!isStreaming);
          }}
          className={`px-4 py-2 rounded-full text-sm font-mono flex items-center gap-2 transition-all ${
            isStreaming
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/15'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isStreaming ? 'animate-spin' : ''}`} />
          <span>{isStreaming ? 'Live Stream Active' : 'Stream Paused'}</span>
        </button>
      </motion.div>

      {activeTab === 'keys' && <ApiKeysTab localKeys={keys} onTest={handleOpenPlayground} />}
      {activeTab === 'security' && <SecurityTab onLogout={onLogout || (() => { window.location.href = '/login'; })} />}
      {activeTab === 'vault' && <VaultAuditTab />}

      {activeTab === 'overview' && (
      <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>THROUGHPUT</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {metrics.currentRps.toFixed(1)} <span className="text-sm font-normal text-slate-400 font-sans">RPS</span>
          </div>
          <div className="text-xs text-emerald-400 font-mono mt-1">
            Peak: {metrics.peakRps.toFixed(1)} RPS
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>AVG EDGE LATENCY</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {metrics.avgLatencyMs.toFixed(1)} <span className="text-sm font-normal text-slate-400 font-sans">ms</span>
          </div>
          <div className="text-xs text-cyan-400 font-mono mt-1">
            P99: {metrics.p99LatencyMs.toFixed(1)} ms
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>TOTAL INFERENCES</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {(metrics.totalRequestsToday / 1_000_000).toFixed(2)}M
          </div>
          <div className="text-xs text-amber-400 font-mono mt-1">
            {(metrics.totalTokensToday / 1_000_000).toFixed(0)}M Tokens Today
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>EARTH-MARS RELAY</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            ~{metrics.earthMarsDelayMinutes} <span className="text-sm font-normal text-slate-400 font-sans">min</span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            Error Rate: {(metrics.errorRate * 100).toFixed(3)}%
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Real-Time Waveform Telemetry
                </h3>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
                <button
                  onClick={() => { playTerminalBlip(600); setActiveMetricTab('rps'); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeMetricTab === 'rps' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  RPS
                </button>
                <button
                  onClick={() => { playTerminalBlip(650); setActiveMetricTab('tokens'); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeMetricTab === 'tokens' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Tokens/s
                </button>
                <button
                  onClick={() => { playTerminalBlip(700); setActiveMetricTab('latency'); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${activeMetricTab === 'latency' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Latency
                </button>
              </div>
            </div>
            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              {activeMetricTab === 'rps' && renderSparkline(metrics.rpsHistory, '#06b6d4', '#06b6d4')}
              {activeMetricTab === 'tokens' && renderSparkline(metrics.tokenThroughputHistory, '#f59e0b', '#f59e0b')}
              {activeMetricTab === 'latency' && renderSparkline(metrics.latencyHistory, '#10b981', '#10b981')}
            </div>
          </div>
          
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Radio className="w-5 h-5 text-emerald-400" />
              Live Inbound Request Stream
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Origin Unit</th>
                    <th className="py-3 px-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requestLogs.slice(0, 5).map((req: any) => (
                    <tr key={req.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 text-slate-400">{req.timestamp}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                          {req.status} OK
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-200">{req.origin}</td>
                      <td className="py-3 px-3 text-right text-emerald-400">{req.latencyMs.toFixed(1)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-6">
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 font-display">
              <Key className="w-5 h-5 text-amber-400" />
              Active Keys Snapshot
            </h3>
            <div className="space-y-3">
              {keys.filter((k: any) => k.status === 'active').slice(0, 4).map((k: any) => (
                <div key={k.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-amber-500/30 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-white">{k.name}</div>
                    <div className="text-xs text-slate-400">{k.tier}</div>
                  </div>
                  <button
                    onClick={() => handleOpenPlayground(k)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/40 transition-colors"
                  >
                    Test
                  </button>
                </div>
              ))}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsTerminalOpen(true)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Manage all keys via Terminal →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      </>
      )}
    </motion.div>
  );
}
