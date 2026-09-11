import React, { useState } from 'react';
import { Shield, Smartphone, KeyRound, Check } from 'lucide-react';
export function TwoFactorPanel(){
  const [secret,setSecret]=useState<string|null>(null);
  const [url,setUrl]=useState<string|null>(null);
  const [codes,setCodes]=useState<string[]|null>(null);
  const [token,setToken]=useState('');
  const [msg,setMsg]=useState('');
  const setup=async()=>{
    const r=await fetch('/api/2fa/setup', { method:'POST', credentials:'include' });
    const d=await r.json();
    if(r.ok){ setSecret(d.secret); setUrl(d.otpauth_url); setCodes(d.backup_codes || null); setMsg(d.backup_codes ? 'Secret generated — SAVE backup codes now (shown once)' : 'Secret ready — add to Authenticator'); }
    else setMsg(d.error||'Failed');
  };
  const verify=async()=>{
    const clean = token.replace(/[\s-]/g, '');
    const body = /^\d{6}$/.test(clean) ? { token: clean } : { backupCode: token };
    const r=await fetch('/api/2fa/verify', { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify(body)});
    const d=await r.json();
    setMsg(r.ok? '✅ Tier2 Vault unlocked 10m' : '❌ '+d.error);
  };
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-3">
      <h4 className="text-sm font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-400"/> Tier2 2FA (TOTP)</h4>
      <p className="text-xs text-slate-400">Tier1 perimeter passes → Tier2 vault needs 6-digit TOTP (30s). Hack-proof dual shield.</p>
      <button onClick={setup} className="w-full py-2 rounded-xl bg-white text-black font-bold text-xs">Generate Secret</button>
      {secret && <div className="p-2 rounded bg-white/5 font-mono text-xs break-all"><div className="text-amber-300">Secret: {secret}</div><div className="text-cyan-300 truncate">otpauth: {url}</div><p className="text-slate-500">Add to Google Authenticator → enter 6-digit</p></div>}
      {codes && <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 font-mono text-xs"><div className="text-amber-300 font-bold">Backup codes — save now, shown once:</div><div className="grid grid-cols-2 gap-1 mt-1 text-white">{codes.map(c => <span key={c}>{c}</span>)}</div></div>}
      <div className="flex gap-2">
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="123456 or XXXX-XXXX" maxLength={11} className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm" />
        <button onClick={verify} className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1"><KeyRound className="w-3 h-3"/> Verify</button>
      </div>
      {msg && <div className="text-xs font-mono text-slate-300">{msg}</div>}
    </div>
  );
}
