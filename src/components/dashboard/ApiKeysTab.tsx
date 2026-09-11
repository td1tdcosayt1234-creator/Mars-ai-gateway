import React, { useEffect, useState } from 'react';
import { Key, Plus, RefreshCw, Trash2, FlaskConical, AlertTriangle } from 'lucide-react';
import { playTerminalBlip } from '../../utils/sound';
import { listKeysBackend, generateKeyBackend, revokeKeyBackend } from '../../utils/api';
import { sanitizeInput } from '../../utils/security';

const TIERS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'ares-neural-70b', 'deep-space-vision'];
const ZONES = ['olympus-primary', 'chryse-ground', 'phobos-orbital', 'valles-marineris'];

export function ApiKeysTab({ localKeys, onTest }: any) {
  const [keys, setKeys] = useState<any[]>([]);
  const [source, setSource] = useState<'backend' | 'local'>('backend');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState(TIERS[0]);
  const [zone, setZone] = useState(ZONES[0]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listKeysBackend();
      setKeys(list);
      setSource('backend');
    } catch (e: any) {
      setKeys(localKeys.filter((k: any) => k.status === 'active'));
      setSource('local');
      setError('Backend offline — showing local vault. Keys here do not call the API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setError(null);
    setCreating(true);
    try {
      const clean = sanitizeInput(name, 64);
      await generateKeyBackend(tier, zone, clean || undefined);
      setName('');
      playTerminalBlip(880);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm(`Revoke key ${id}? This cannot be undone.`)) return;
    try {
      await revokeKeyBackend(id);
      playTerminalBlip(300);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Revoke failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Plus className="w-5 h-5 text-emerald-400" /> New API Key
          <span className={`ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full border ${source === 'backend' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
            {source === 'backend' ? 'BACKEND VAULT' : 'LOCAL ONLY'}
          </span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">Least-privilege: single model, chat-only scope, 90-day expiry. Secret shows once at creation.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={name} onChange={e => setName(e.target.value.slice(0, 64))} placeholder="Key name (optional)" className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
          <select value={tier} onChange={e => setTier(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={zone} onChange={e => setZone(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <button onClick={create} disabled={creating} className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-60">
            {creating ? 'Creating...' : 'Generate Key'}
          </button>
        </div>
        {error && <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs font-mono text-amber-200 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
      </div>

      <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Key className="w-5 h-5 text-amber-400" /> Keys ({keys.length})</h3>
          <button onClick={() => { playTerminalBlip(600); load(); }} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {loading ? <div className="text-sm text-slate-500 font-mono">Loading vault...</div> : keys.length === 0 ? (
          <div className="text-sm text-slate-500">No keys yet — generate one above.</div>
        ) : (
          <div className="space-y-3">
            {keys.map((k: any) => (
              <div key={k.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-amber-500/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{k.name || k.id}</div>
                    <div className="text-xs text-slate-400 font-mono">{k.keyMasked || k.key?.slice(0, 14) + '••••'} · {k.tier} · {k.relayZone || k.zone}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {k.models ? `models: ${k.models.join(', ')} · ` : ''}{k.expiresAt ? `expires ${new Date(k.expiresAt).toLocaleDateString()} · ` : ''}status: {k.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {source === 'backend' && (
                      <button onClick={() => onTest(k)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/40 transition-colors flex items-center gap-1">
                        <FlaskConical className="w-3.5 h-3.5" /> Test
                      </button>
                    )}
                    {source === 'backend' ? (
                      <button onClick={() => revoke(k.id)} className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">local mock</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
