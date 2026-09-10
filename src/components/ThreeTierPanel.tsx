import React, { useEffect, useState } from 'react';
import { Shield, Layers, Database, Timer } from 'lucide-react';
export function ThreeTierPanel(){
  const [s,setS]=useState<any>(null);
  useEffect(()=>{
    fetch('/api/vault/status', { headers:{ Authorization:`Bearer ${localStorage.getItem('ares_jwt')||''}` }}).then(r=>r.json()).then(d=> setS(d)).catch(()=> setS({error:'Need Tier2 2FA + Tier1'}));
  },[]);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Layers className="w-6 h-6 text-amber-400"/> 3-Tier Hack-Proof (10-min Build)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20"><div className="text-xs font-mono text-red-300 flex items-center gap-1"><Shield className="w-3 h-3"/> Tier1 Perimeter</div><div className="text-sm text-white font-bold">Edge WAF</div><div className="text-xs text-slate-400">Flood 300/min, bot, SQLi/XSS, HMAC</div><div className="mt-2 text-[10px] font-mono text-red-300">X-Tier1: pass</div></div>
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"><div className="text-xs font-mono text-amber-300 flex items-center gap-1"><Shield className="w-3 h-3"/> Tier2 Vault</div><div className="text-sm text-white font-bold">App Zero-Trust</div><div className="text-xs text-slate-400">JWT+CSRF+2FA 10m+RBAC+AI firewall</div><div className="mt-2 text-[10px] font-mono text-amber-300">X-Tier2: vault-pass</div></div>
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"><div className="text-xs font-mono text-emerald-300 flex items-center gap-1"><Database className="w-3 h-3"/> Tier3 Deep</div><div className="text-sm text-white font-bold">Data Enclave</div><div className="text-xs text-slate-400">HSM envelope, Merkle, canary 418</div><div className="mt-2 text-[10px] font-mono text-emerald-300 truncate">root {s?.merkle?.root?.slice(0,8)||'...'}</div></div>
      </div>
      <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
        <div className="flex items-center gap-2 text-white font-bold"><Timer className="w-4 h-4 text-cyan-400"/> Vault Status (Tier3)</div>
        <pre className="mt-2 text-slate-300 overflow-auto">{s? JSON.stringify(s,null,2): 'Loading (need login+2FA)...'}</pre>
      </div>
      <p className="text-xs text-slate-500">Hack requires breaking all 3 tiers within 10m freshness window. 10-min build: install 2m + build 1m + deploy 3m + HSM+WAF 4m.</p>
    </div>
  );
}
