import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Orbit, Fingerprint, Lock, ArrowRight, ShieldAlert, Clock, Eye, EyeOff, Server, Github, Chrome } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { motion } from 'motion/react';
import {
  verifyAccessCode,
  isLockedOut,
  getLockoutRemainingMs,
  recordLoginAttempt,
  createSession,
  isSessionValid,
  sanitizeInput,
  SECURITY_CONFIG,
  auditLog,
} from '../utils/security';
import { loginBackend, verifyBackend, hasBackendToken } from '../utils/api';

export function LoginPage() {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [lockoutMs, setLockoutMs] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS);
  const [backendMode, setBackendMode] = useState<'checking' | 'online' | 'offline'>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const c = await fetch('/api/health', { method: 'GET' }).then(r=>r.ok).catch(()=>false);
        setBackendMode(c ? 'online' : 'offline');
      } catch { setBackendMode('offline'); }
    })();
    // OAuth token in URL hash/query (from backend redirect)
    const params=new URLSearchParams(window.location.search);
    const oauthToken=params.get('token');
    const oauth=params.get('oauth');
    if(oauthToken){
      localStorage.setItem('ares_jwt', oauthToken);
      await createSession();
      auditLog('login_oauth_'+oauth, 'jwt stored');
      window.history.replaceState({}, '', '/dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }
    (async () => {
      if (hasBackendToken()) {
        const ok = await verifyBackend().catch(()=>false);
        if (ok) { navigate('/dashboard', { replace: true }); return; }
      }
      if (isSessionValid()) navigate('/dashboard', { replace: true });
    })();
  }, [navigate]);

  useEffect(() => {
    const update = () => {
      const rem = getLockoutRemainingMs();
      setLockoutMs(rem);
      try {
        const raw = localStorage.getItem('ares_login_attempts_v2');
        const arr = raw ? JSON.parse(raw) : [];
        const fails = arr.filter((a: any) => a.fail).length;
        setAttemptsLeft(Math.max(0, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - fails));
      } catch { setAttemptsLeft(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS); }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const formatLockout = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isLockedOut()) {
      setError(`Security lockout active. Try again in ${formatLockout(getLockoutRemainingMs())}.`);
      playTerminalBlip(300);
      auditLog('login_blocked_lockout', 'attempt during lockout');
      return;
    }
    const clean = sanitizeInput(accessCode, SECURITY_CONFIG.MAX_CODE_LENGTH);
    if (!clean || clean.length < 4) {
      setError('Authorization cipher must be at least 4 characters.');
      return;
    }
    playTerminalBlip(800);
    setIsLoading(true);
    try {
      if (backendMode !== 'offline') {
        try {
          const res = await loginBackend(clean);
          if (res.token) {
            await createSession();
            recordLoginAttempt(true);
            auditLog('login_success_backend', `backend jwt`);
            setIsLoading(false);
            navigate('/dashboard');
            return;
          }
        } catch (be: any) {
          if (be.message && !be.message.includes('Failed to fetch') && !be.message.includes('NetworkError')) {
            recordLoginAttempt(false);
            const remaining = getLockoutRemainingMs();
            if (remaining > 0) setError(`Too many failed attempts. Locked for ${formatLockout(remaining)}.`);
            else {
              const left = attemptsLeft - 1;
              setError(be.message + ` ${Math.max(0, left)} attempts left.`);
            }
            playTerminalBlip(220);
            setIsLoading(false);
            auditLog('login_fail_backend', be.message.slice(0,80));
            return;
          }
          setBackendMode('offline');
        }
      }
      const start = Date.now();
      const minDelay = 600 + Math.floor(Math.random() * 300);
      const ok = await verifyAccessCode(clean);
      const elapsed = Date.now() - start;
      if (elapsed < minDelay) await new Promise(r => setTimeout(r, minDelay - elapsed));
      if (ok) {
        recordLoginAttempt(true);
        await createSession();
        auditLog('login_success_offline', `client fallback`);
        setIsLoading(false);
        navigate('/dashboard');
      } else {
        recordLoginAttempt(false);
        auditLog('login_fail_offline', `invalid code len=${clean.length}`);
        const remaining = getLockoutRemainingMs();
        if (remaining > 0) setError(`Too many failed attempts. Locked for ${formatLockout(remaining)}.`);
        else {
          const left = attemptsLeft - 1;
          setError(`Invalid authorization cipher. ${Math.max(0, left)} attempts remaining before lockout.`);
        }
        playTerminalBlip(220);
        setIsLoading(false);
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('Authentication subsystem error. Please retry.');
      auditLog('login_error', String(err).slice(0,100));
    }
  };

  const isLocked = lockoutMs > 0 || isLockedOut();

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="flex-1 w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-500/20 rounded-tl-3xl" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-500/20 rounded-br-3xl" />
        <div className="flex flex-col items-center mb-6">
          <div className="relative flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-600/30 border border-amber-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <Orbit className="w-8 h-8 text-amber-400 animate-[spin_12s_linear_infinite]" />
            <div className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fbbf24]" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight font-display drop-shadow-md">Gateway Access</h2>
          <p className="text-slate-400 text-sm mt-1 font-mono">Olympus Mons Command Hub</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"><ShieldAlert className="w-3 h-3" />Hardened • Super Security</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] ${backendMode==='online'?'bg-cyan-500/10 text-cyan-300 border-cyan-500/20': backendMode==='offline'?'bg-amber-500/10 text-amber-300 border-amber-500/20':'bg-white/5 text-slate-400 border-white/10'}`}><Server className="w-3 h-3" />{backendMode==='online'?'Backend: ONLINE': backendMode==='offline'?'Backend: OFFLINE':'Checking...'}</span>
          </div>
        </div>

        {/* Super Security OAuth */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <a href="/api/auth/oauth/github" onClick={()=> playTerminalBlip(700)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-100 transition-colors border border-white/10">
            <Github className="w-4 h-4" /> GitHub
          </a>
          <a href="/api/auth/oauth/google" onClick={()=> playTerminalBlip(700)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-sm backdrop-blur transition-colors">
            <Chrome className="w-4 h-4 text-red-400" /> Google
          </a>
        </div>
        <div className="relative flex items-center gap-2 mb-5">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[11px] font-mono text-slate-500">OR CIPHER</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10" autoComplete="off">
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Security Code</label>
            <div className="relative">
              <input type={showCode ? 'text' : 'password'} value={accessCode} onChange={(e) => setAccessCode(e.target.value.slice(0, SECURITY_CONFIG.MAX_CODE_LENGTH))} placeholder="MARS-OLYMPUS-2026" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono text-sm disabled:opacity-50" required disabled={isLocked || isLoading} autoComplete="off" spellCheck={false} maxLength={SECURITY_CONFIG.MAX_CODE_LENGTH} />
              <button type="button" onClick={() => setShowCode(!showCode)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors" tabIndex={-1}>{showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            <div className="flex justify-between text-[11px] font-mono"><span className={attemptsLeft <= 2 ? 'text-amber-400' : 'text-slate-500'}>Attempts left: {isLocked ? 0 : attemptsLeft}</span><span className="text-slate-500">Super: JWT 30m + HMAC + AES-GCM</span></div>
          </div>
          {isLocked && <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center gap-2 text-xs font-mono text-red-300"><Clock className="w-4 h-4 animate-pulse" /><span>Lockout active — retry in {formatLockout(lockoutMs)}</span></div>}
          {error && !isLocked && <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs font-mono text-amber-200">{error}</div>}
          <button type="submit" disabled={isLoading || isLocked} className="w-full group relative flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {isLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />Authenticating...</span> : isLocked ? <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Locked — Wait {formatLockout(lockoutMs)}</span> : <span className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-amber-600" />Initialize Uplink<ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" /></span>}
          </button>
          <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-center">
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-400"><div className="text-emerald-400 font-bold">OAuth</div><div>GitHub + Google</div></div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-400"><div className="text-cyan-400 font-bold">2FA</div><div>TOTP ready</div></div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-400"><div className="text-amber-400 font-bold">Super</div><div>IP+UA+COEP</div></div>
          </div>
        </form>
        <div className="mt-4 text-center">
          <p className="text-[10px] text-slate-600 font-mono">OAuth needs GITHUB_/GOOGLE_ env in Render → /api/auth/oauth/*</p>
        </div>
      </div>
    </motion.div>
  );
}
