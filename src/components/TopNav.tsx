import React from 'react';
import { Terminal, Key, Activity, BookOpen, Orbit, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';

interface TopNavProps {
  activeTab: 'home' | 'keys' | 'terminal' | 'telemetry' | 'docs';
  onSelectTab: (tab: 'home' | 'keys' | 'terminal' | 'telemetry' | 'docs') => void;
  onOpenNewKeyModal: () => void;
  audioActive: boolean;
  onToggleAudio: () => void;
  keysCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewKeyModal,
  audioActive,
  onToggleAudio,
  keysCount,
}) => {
  return (
    <header className="relative z-30 flex items-center justify-between px-6 md:px-12 py-6 w-full">
      {/* Brand Logo (Matching WoodNest placement) */}
      <div 
        onClick={() => {
          playTerminalBlip(600);
          onSelectTab('home');
        }}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-600/30 border border-amber-500/30 backdrop-blur-md shadow-[0_0_18px_rgba(245,158,11,0.25)] group-hover:border-amber-400/60 transition-all duration-300">
          <Orbit className="w-5 h-5 text-amber-400 animate-[spin_12s_linear_infinite]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#fbbf24]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
              Ares<span className="text-amber-400 font-extrabold">AI</span>
            </span>
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Mars-Relay
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sol 782 · 14ms Local Relay
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
        <button
          onClick={() => {
            playTerminalBlip(700);
            onSelectTab('home');
          }}
          className={`transition-colors duration-200 ${
            activeTab === 'home' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          Gateway
        </button>

        <button
          onClick={() => {
            playTerminalBlip(720);
            onSelectTab('keys');
          }}
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            activeTab === 'keys' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 text-amber-400" />
          Key Vault
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-mono">
            {keysCount}
          </span>
        </button>

        <button
          onClick={() => {
            playTerminalBlip(750);
            onSelectTab('terminal');
          }}
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            activeTab === 'terminal' ? 'text-amber-300 font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          Terminal CLI
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </button>

        <button
          onClick={() => {
            playTerminalBlip(780);
            onSelectTab('telemetry');
          }}
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            activeTab === 'telemetry' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          Telemetry
        </button>

        <button
          onClick={() => {
            playTerminalBlip(800);
            onSelectTab('docs');
          }}
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            activeTab === 'docs' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4 text-slate-400" />
          Docs
        </button>
      </nav>

      {/* Right Action buttons */}
      <div className="flex items-center gap-3">
        {/* Audio atmosphere toggle */}
        <button
          onClick={onToggleAudio}
          title={audioActive ? 'Mute Mars atmospheric audio' : 'Play Mars deep space hum'}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all"
        >
          {audioActive ? (
            <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Primary CTA (Matching the white pill button 'Book Now' in reference image) */}
        <button
          id="btn-request-key-top"
          onClick={() => {
            playTerminalBlip(950);
            onOpenNewKeyModal();
          }}
          className="relative px-6 py-2.5 rounded-full bg-white text-neutral-950 font-semibold text-sm hover:bg-slate-100 active:scale-95 transition-all shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Request Key</span>
        </button>
      </div>
    </header>
  );
};
