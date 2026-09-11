import React, { useEffect, useState } from 'react';
import { ShieldCheck, Timer, LogOut, RefreshCw, MonitorSmartphone, HeartPulse, Link2 } from 'lucide-react';
import { playTerminalBlip } from '../../utils/sound';
import { fetchSession, refreshBackend, logoutBackend, logoutAllBackend, fetchChainVerify } from '../../utils/api';
import { TwoFactorPanel } from '../TwoFactorPanel';

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'expired';
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function SecurityTab({ onLogout }: any) {
  const [exp, setExp] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const loadSession = async () => {
    const s = await fetchSession();
    if (s.valid) {
      setExp(s.exp ? s.exp * 1000 : null);
      setUser(s.user || null);
    } else {
      setExp(null);
      setUser(null);
    }
  };

  useEffect(() => {
    loadSession();
    fetch('/api/health', { credentials: 'include' }).then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    fetchChainVerify().then(setChain).catch(() => setChain(null));
    const id = setInterval(loadSession, 15000);
    return () => clearInterval(id);
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const doRefresh = async () => {
    playTerminalBlip(700);
    const ok = await refreshBackend();
    setMsg(ok ? 'Session rotated (old token revoked)' : 'Refresh failed — re-login');
    await loadSession();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Timer className="w-5 h-5 text-cyan-400" /> Session</h3>
          {exp ? (
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between"><span className="text-slate-400">Expires in</span><span className="text-emerald-300 font-bold">{fmtCountdown(exp - now)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Subject</span><span className="text-slate-200 truncate max-w-[60%]">{user?.sub || user?.jti || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Issuer</span><span className="text-slate-200">{user?.iss || 'mars-gateway'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Client binding</span><span className="text-emerald-300">UA fingerprint ✓</span></div>
            </div>
          ) : (
            <div className="text-sm text-amber-300 font-mono">No backend session — local demo mode.</div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button onClick={doRefresh} className="py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Rotate
            </button>
            <button onClick={async () => { await logoutBackend(); onLogout(); }} className="py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-1">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
            <button onClick={async () => { if (confirm('Revoke ALL sessions on every device?')) { await logoutAllBackend(); onLogout(); } }} className="py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold hover:bg-red-500/25 transition-colors">
              All devices
            </button>
          </div>
          {msg && <div className="mt-3 text-xs font-mono text-slate-300">{msg}</div>}
        </div>

        <TwoFactorPanel />
      </div>

      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><HeartPulse className="w-5 h-5 text-emerald-400" /> Backend Health</h3>
          {health ? (
            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div className="p-3 rounded-xl bg-white/5"><div className="text-slate-400 text-xs">STATUS</div><div className="text-emerald-300 font-bold">{health.status}</div></div>
              <div className="p-3 rounded-xl bg-white/5"><div className="text-slate-400 text-xs">UPTIME</div><div className="text-white font-bold">{Math.floor(health.uptime / 60)}m</div></div>
              <div className="p-3 rounded-xl bg-white/5"><div className="text-slate-400 text-xs">CSP/HSTS</div><div className="text-emerald-300 font-bold">{health.csp}/{health.hsts}</div></div>
              <div className="p-3 rounded-xl bg-white/5"><div className="text-slate-400 text-xs">SOL</div><div className="text-white font-bold">{health.sol}</div></div>
            </div>
          ) : <div className="text-sm text-slate-500 font-mono">Backend unreachable.</div>}
        </div>

        <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><Link2 className="w-5 h-5 text-purple-400" /> Audit Chain</h3>
          {chain ? (
            <div className={`text-sm font-mono font-bold ${chain.valid ? 'text-emerald-300' : 'text-red-300'}`}>
              {chain.valid ? '✓ Hash chain intact' : '✗ CHAIN BROKEN — investigate'}
            </div>
          ) : <div className="text-sm text-slate-500 font-mono">Verifying...</div>}
          <div className="mt-3 text-xs font-mono text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> JWT iss/aud + fingerprint bound</div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Logout revokes (denylist), refresh rotates</div>
            <div className="flex items-center gap-1.5"><MonitorSmartphone className="w-3.5 h-3.5 text-emerald-400" /> CSRF double-submit + Origin check</div>
          </div>
        </div>
      </div>
    </div>
  );
}
