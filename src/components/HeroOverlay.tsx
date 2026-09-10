import React from 'react';
import { Star, ShieldCheck, Zap, Radio } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';

interface HeroOverlayProps {
  onOpenTerminal: () => void;
  onOpenTelemetry: () => void;
}

export const HeroOverlay: React.FC<HeroOverlayProps> = ({
  onOpenTerminal,
  onOpenTelemetry,
}) => {
  return (
    <div className="flex flex-col justify-between h-full max-w-2xl py-4 lg:py-8 z-20 pointer-events-auto">
      {/* Top / Main Heading: Exactly matching the big 3-line display typography in reference */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-amber-500/30 backdrop-blur-md text-amber-300 text-xs font-mono">
          <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>DEEP SPACE TELEMETRY ACTIVE</span>
          <span className="text-slate-400">·</span>
          <span className="text-emerald-400">STATUS: NOMINAL</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] font-sans">
          Martian<br />
          Neural<br />
          <span className="bg-gradient-to-r from-white via-amber-100 to-amber-400 bg-clip-text text-transparent">
            Gateway
          </span>
        </h1>
      </div>

      {/* Bottom info section: paragraph + badge matching reference */}
      <div className="mt-8 lg:mt-16 space-y-6">
        <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          Zero-trust AI API key gateway on the Martian frontier. High-throughput edge inference
          powering autonomous rovers, orbital spectrometers, and colony habitat life-support networks.
        </p>

        {/* Rating / Telemetry pill matching "★ 4.7 from 1,800+ stays" */}
        <div className="flex flex-wrap items-center gap-4">
          <div 
            onClick={() => {
              playTerminalBlip(800);
              onOpenTelemetry();
            }}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md cursor-pointer transition-all duration-200 group"
          >
            <div className="flex items-center text-amber-400">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="ml-1.5 font-bold text-white text-sm">99.998%</span>
            </div>
            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
              from 1.2M+ planetary relays
            </span>
          </div>

          <div 
            onClick={() => {
              playTerminalBlip(750);
              onOpenTerminal();
            }}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 backdrop-blur-md cursor-pointer transition-all text-xs font-mono text-emerald-300"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>&gt;_ ares-cli ready</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Quantum-Secured ED25519</span>
          </div>
        </div>
      </div>
    </div>
  );
};
