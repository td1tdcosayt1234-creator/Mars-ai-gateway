import React from 'react';
import { X, BookOpen, Terminal, Shield, Zap, Radio, Globe } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerminal: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({
  isOpen,
  onClose,
  onOpenTerminal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[#07090f] border border-amber-500/30 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d121c] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Ares AI Gateway Documentation
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Martian Planetary Inference Specifications & Architecture
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed font-sans">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              1. The Mars Latency Problem & Solution
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Earth and Mars are separated by an orbital distance between 54.6 million and 401 million kilometers. Radio transmissions encounter a <strong>4.3 to 22.4 minute one-way delay</strong> (speed-of-light physical barrier).
            </p>
            <p className="text-xs sm:text-sm text-slate-300">
              The <strong>Ares AI Gateway</strong> solves this by hosting edge neural clusters directly on the surface of Mars (Olympus Mons and Chryse Planitia hubs). Requests are handled locally in <strong>sub-15 milliseconds</strong>, allowing autonomous rovers, life support systems, and orbital probes to operate in real time without waiting for Earth rounds.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              2. Authentication & Header Specs
            </h3>
            <p className="text-xs text-slate-400">
              Include your issued API Key in the standard HTTP Authorization header:
            </p>
            <div className="bg-black/60 p-3.5 rounded-xl border border-white/10 font-mono text-xs text-slate-200">
              Authorization: Bearer ak_mars_live_9f82d7a6e14b09c2b3e81<br />
              X-Mars-Relay: olympus-primary<br />
              Content-Type: application/json
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              3. Automated CLI & CI/CD Integration
            </h3>
            <p className="text-xs text-slate-400">
              You can provision, rotate, and revoke keys straight from your rover firmware or automated deployment pipeline using the Ares CLI:
            </p>
            <div className="bg-black/60 p-3.5 rounded-xl border border-white/10 font-mono text-xs text-emerald-300 space-y-1">
              <div># Provision new Flash key for autonomous rover unit</div>
              <div>ares keys new Rover-Unit-08 --tier=flash --zone=olympus-primary</div>
              <div className="pt-1 text-slate-400"># Check live telemetry & queue latency</div>
              <div>ares metrics --watch</div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  playTerminalBlip(800);
                  onClose();
                  onOpenTerminal();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Launch Interactive Terminal CLI Now</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
