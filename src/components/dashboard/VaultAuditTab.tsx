import React, { useEffect, useState } from 'react';
import { ScrollText, Link2, RefreshCw } from 'lucide-react';
import { ThreeTierPanel } from '../ThreeTierPanel';
import { fetchMyAudit, fetchChainVerify } from '../../utils/api';
import { playTerminalBlip } from '../../utils/sound';

export function VaultAuditTab() {
  const [audit, setAudit] = useState<any[]>([]);
  const [chain, setChain] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([fetchMyAudit(), fetchChainVerify()]);
    setAudit(a);
    setChain(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <ThreeTierPanel />

      <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-cyan-400" /> My Audit Trail
            {chain && (
              <span className={`ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${chain.valid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                <Link2 className="w-3 h-3 inline mr-1" />{chain.valid ? 'CHAIN OK' : 'CHAIN BROKEN'}
              </span>
            )}
          </h3>
          <button onClick={() => { playTerminalBlip(600); load(); }} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {loading ? <div className="text-sm text-slate-500 font-mono">Loading...</div> : audit.length === 0 ? (
          <div className="text-sm text-slate-500">No entries yet — logins, key events and refreshes appear here.</div>
        ) : (
          <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto">
            {audit.map((a: any, i: number) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 bg-white/5 p-2.5 rounded-lg">
                <span className="text-slate-200">{new Date(a.ts).toLocaleTimeString()} · {a.action}</span>
                <span className="text-slate-400 truncate max-w-[55%]">{a.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
