import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Orbit, Volume2, VolumeX, Sparkles, Box, LogIn, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { isSessionValid, clearSession, auditLog } from '../utils/security';

interface TopNavProps {
  onOpenNewKeyModal: () => void;
  audioActive: boolean;
  onToggleAudio: () => void;
  keysCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenNewKeyModal,
  audioActive,
  onToggleAudio,
  keysCount,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isSessionValid());
    const id = setInterval(()=> setAuthed(isSessionValid()), 5000);
    return ()=> clearInterval(id);
  }, [location.pathname]);

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-1.5 transition-colors duration-200 ${
      isActive ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
    }`;
  };

  const handleLogout = () => {
    playTerminalBlip(600);
    clearSession();
    auditLog('logout', 'nav logout');
    setAuthed(false);
    navigate('/login');
  };

  return (
    <header className="relative z-30 flex items-center justify-between px-6 md:px-12 py-6 w-full">
      <Link 
        to="/"
        onClick={() => playTerminalBlip(600)}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-600/30 border border-amber-500/30 backdrop-blur-md shadow-[0_0_18px_rgba(245,158,11,0.25)] group-hover:border-amber-400/60 transition-all duration-300">
          <Orbit className="w-5 h-5 text-amber-400 animate-[spin_12s_linear_infinite]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#fbbf24]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white font-display flex items-center gap-1.5">
              Ares<span className="text-amber-400 font-extrabold">AI</span>
            </span>
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Mars-Relay
            </span>
            {authed && <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><ShieldCheck className="w-3 h-3" />Secured</span>}
          </div>
          <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sol 782 · 14ms Local Relay {authed ? `· ${keysCount} keys` : ''}
          </p>
        </div>
      </Link>

      <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
        <Link to="/" onClick={() => playTerminalBlip(700)} className={getLinkClass('/')}>Home</Link>
        <Link to="/models" onClick={() => playTerminalBlip(720)} className={getLinkClass('/models')}>
          <Box className="w-4 h-4 text-amber-400" />Models
        </Link>
        <Link to="/dashboard" onClick={() => playTerminalBlip(750)} className={getLinkClass('/dashboard')}>
          <LayoutDashboard className="w-4 h-4 text-cyan-400" />Dashboard
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleAudio}
          title={audioActive ? 'Mute Mars atmospheric audio' : 'Play Mars deep space hum'}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all"
        >
          {audioActive ? <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
        </button>

        {authed ? (
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 hover:text-red-200 transition-all flex items-center gap-2"
            title="Secure Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-semibold hidden lg:inline">Logout</span>
          </button>
        ) : (
          <button
            onClick={() => { playTerminalBlip(900); navigate('/login'); }}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-2"
            title="Login"
          >
            <LogIn className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold hidden lg:inline">Login</span>
          </button>
        )}

        <button
          id="btn-request-key-top"
          onClick={() => { playTerminalBlip(950); onOpenNewKeyModal(); }}
          className="relative px-6 py-2.5 rounded-full bg-white text-neutral-950 font-semibold text-sm hover:bg-slate-100 active:scale-95 transition-all shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Request Key</span>
        </button>
      </div>
    </header>
  );
};
