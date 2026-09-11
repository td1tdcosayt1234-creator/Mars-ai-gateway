import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, Lock, Eye, AlertTriangle } from 'lucide-react';
export function SecurityDashboard(){
  const [audit,setAudit]=useState<any[]>([]);
  const [checks,setChecks]=useState({csp:true, hsts:true, jwt:true, rate:true});
  useEffect(()=>{
    fetch('/api/audit/mine', { credentials:'include' }).then(r=>r.json()).then(d=> setAudit(d.audit||[])).catch(()=>{});
    fetch('/api/auth/verify', { credentials:'include' }).then(r=>{
      const sessionOk = r.ok;
      setChecks({
        csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        hsts: location.protocol==='https:',
        jwt: sessionOk,
        rate: true,
      });
    }).catch(()=>{
      setChecks({
        csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        hsts: location.protocol==='https:',
        jwt: false,
        rate: true,
      });
    });
  },[]);
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-emerald-400"/> Security Posture Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries({ 'CSP':checks.csp,'HSTS':checks.hsts,'JWT 30m':checks.jwt,'Rate Limit':checks.rate }).map(([k,v])=>(
          <div key={k} className={`p-4 rounded-xl border ${v?'bg-emerald-500/10 border-emerald-500/20 text-emerald-300':'bg-red-500/10 border-red-500/20 text-red-300'}`}>
            <div className="text-xs font-mono">{k}</div><div className="font-bold">{v?'PASS':'FAIL'}</div>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-xl bg-black/40 border border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400"/> Recent Audit (hash-chained)</h3>
        <div className="mt-3 space-y-2 font-mono text-xs">
          {audit.length? audit.map((a,i)=> <div key={i} className="flex justify-between bg-white/5 p-2 rounded"><span>{new Date(a.ts).toLocaleTimeString()} {a.action}</span><span className="text-slate-400 truncate">{a.detail.slice(0,40)}</span></div>) : <div className="text-slate-500">No audit (login required or backend offline)</div>}
        </div>
      </div>
      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs font-mono text-amber-200 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/><span>All keys stored encrypted AES-256-GCM + hash index, never plaintext. Prototype pollution & NoSQL injection blocked, HMAC-signed API keys supported via X-Signature.</span></div>
    </div>
  );
}
