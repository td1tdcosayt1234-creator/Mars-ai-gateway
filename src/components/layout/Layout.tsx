import React from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import marsBgImage from '../../assets/images/mars_gateway_bg_1789040540420.jpg';
import { TopNav } from '../TopNav';
import { StarfieldCanvas } from '../StarfieldCanvas';
import { playTerminalBlip } from '../../utils/sound';

export function Layout({ 
  keysCount, 
  audioActive, 
  handleToggleAudio, 
  setIsNewKeyModalOpen, 
  setIsTerminalOpen,
  metrics,
  onLogout
}: any) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';

  return (
    <main className="relative min-h-screen w-full bg-[#030407] text-slate-100 flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8 select-none font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.08),_transparent_70%)]" />
      <div className="relative w-full max-w-[1520px] min-h-[92vh] rounded-[24px] sm:rounded-[32px] md:rounded-[40px] border border-white/20 sm:border-white/25 shadow-[0_0_80px_rgba(0,0,0,0.9),_inset_0_0_30px_rgba(255,255,255,0.04)] overflow-hidden flex flex-col justify-between backdrop-blur-sm bg-black">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-100" style={{ backgroundImage: `url(${marsBgImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_60%,_rgba(245,158,11,0.12),_transparent_60%)] pointer-events-none" />
        <StarfieldCanvas stormDensity={0.25} />
        {!isLoginPage && (
          <TopNav
            onOpenNewKeyModal={() => setIsNewKeyModalOpen(true)}
            audioActive={audioActive}
            onToggleAudio={handleToggleAudio}
            keysCount={keysCount}
          />
        )}
        <div className="relative z-20 flex-1 flex flex-col w-full h-full">
          <Outlet />
        </div>
        {!isLoginPage && (
          <footer className="relative z-20 flex flex-wrap items-center justify-between px-6 sm:px-10 md:px-14 py-4 text-xs font-mono text-slate-400/80 border-t border-white/5 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button onClick={() => { playTerminalBlip(800); setIsTerminalOpen(true); }} className="flex items-center gap-1.5 hover:text-amber-300 transition-colors cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>&gt;_ Open Mars Terminal (ares-cli)</span>
              </button>
              <span className="hidden sm:inline text-white/20">|</span>
              <button onClick={() => { playTerminalBlip(750); navigate('/dashboard'); }} className="hidden sm:flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer">
                <span>Telemetry: {metrics.currentRps.toFixed(0)} RPS</span>
              </button>
              {onLogout && (
                <>
                  <span className="hidden sm:inline text-white/20">|</span>
                  <button onClick={onLogout} className="hidden sm:flex items-center gap-1.5 hover:text-red-300 transition-colors cursor-pointer">Secure Logout</button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Mars Relay Station #04 · Olympus Mons Hub</span>
              <span className="text-amber-400/80 font-bold">Sol 782</span>
              <span className="hidden sm:inline px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px]">HARDENED</span>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}
