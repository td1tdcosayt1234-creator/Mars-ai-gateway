import React from 'react';
import { ShieldAlert, Brain, Filter, Timer } from 'lucide-react';
export function AISecurityPanel(){
  return (
    <div className="p-4 rounded-2xl bg-[#0a0c12]/80 border border-white/10 backdrop-blur">
      <h4 className="text-sm font-bold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-amber-400"/> AI Gateway Shield</h4>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
        <div className="p-2 rounded bg-white/5"><Filter className="w-3 h-3 inline text-cyan-400"/> Injection firewall<p className="text-slate-400">16 patterns, score ≥50 block</p></div>
        <div className="p-2 rounded bg-white/5"><ShieldAlert className="w-3 h-3 inline text-emerald-400"/> PII vault<p className="text-slate-400">email/phone/SSN redacted</p></div>
        <div className="p-2 rounded bg-white/5"><Timer className="w-3 h-3 inline text-amber-400"/> Token quota<p className="text-slate-400">per-key 50M/mo + RPM</p></div>
        <div className="p-2 rounded bg-white/5">RBAC<p className="text-slate-400">tier→model enforce</p></div>
      </div>
    </div>
  );
}
