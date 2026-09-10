import React, { useState } from 'react';
import { SlidersHorizontal, Cpu, Radio, Zap, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { ModelTier, RelayZone, ApiKeyRecord } from '../types';
import { MODEL_TIER_CONFIG, RELAY_ZONES } from '../data/mockData';
import { playKeySuccess, playTerminalBlip } from '../utils/sound';

interface KeyGeneratorCardProps {
  onGenerateKey: (tier: ModelTier, relayZone: RelayZone, customName?: string) => ApiKeyRecord;
  onOpenTerminal: () => void;
  onOpenPlayground: (key: ApiKeyRecord) => void;
}

export const KeyGeneratorCard: React.FC<KeyGeneratorCardProps> = ({
  onGenerateKey,
  onOpenTerminal,
  onOpenPlayground,
}) => {
  const [selectedTier, setSelectedTier] = useState<ModelTier>('gemini-2.5-flash');
  const [selectedRelay, setSelectedRelay] = useState<RelayZone>('olympus-primary');
  const [createdKey, setCreatedKey] = useState<ApiKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const tierInfo = MODEL_TIER_CONFIG[selectedTier];
  const relayInfo = RELAY_ZONES[selectedRelay];

  const handleGenerate = () => {
    setIsGenerating(true);
    playTerminalBlip(880);

    setTimeout(() => {
      const newRecord = onGenerateKey(
        selectedTier,
        selectedRelay,
        `Console Client (${tierInfo.label.split(' ')[0]})`
      );
      setCreatedKey(newRecord);
      setIsGenerating(false);
      playKeySuccess();
    }, 400);
  };

  const handleCopy = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    playTerminalBlip(1200);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md bg-[#0a0c12]/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-20 transition-all duration-300 pointer-events-auto">
      {/* Card Header (matching Evergreen Pine Family Lodge) */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 font-display">
            Ares Gateway Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant Mars-Relay Key Provisioning
          </p>
        </div>
        <button
          onClick={onOpenTerminal}
          title="Open CLI Settings"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Selectors grid matching the [Feb 11 v] [Mar 25 v] input pair in reference photo */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Model Tier Selector */}
        <div className="relative flex flex-col justify-center px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-amber-400" />
            <span>AI Model Tier</span>
          </label>
          <select
            value={selectedTier}
            onChange={(e) => {
              playTerminalBlip(650);
              setSelectedTier(e.target.value as ModelTier);
            }}
            className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer truncate"
          >
            <option value="gemini-2.5-flash" className="bg-neutral-900 text-white">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro" className="bg-neutral-900 text-white">Gemini 2.5 Pro</option>
            <option value="ares-neural-70b" className="bg-neutral-900 text-white">Ares-Neural 70B</option>
            <option value="deep-space-vision" className="bg-neutral-900 text-white">DeepSpace Vision</option>
          </select>
        </div>

        {/* Relay Zone Selector */}
        <div className="relative flex flex-col justify-center px-3.5 py-2.5 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>Mars Relay</span>
          </label>
          <select
            value={selectedRelay}
            onChange={(e) => {
              playTerminalBlip(680);
              setSelectedRelay(e.target.value as RelayZone);
            }}
            className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer truncate"
          >
            <option value="olympus-primary" className="bg-neutral-900 text-white">Olympus Mons</option>
            <option value="chryse-ground" className="bg-neutral-900 text-white">Chryse Planitia</option>
            <option value="phobos-orbital" className="bg-neutral-900 text-white">Phobos Orbital</option>
            <option value="valles-marineris" className="bg-neutral-900 text-white">Valles Marineris</option>
          </select>
        </div>
      </div>

      {/* Sub-details (matching "Check-in: After 2:00 PM" / "Check-out: Until 12:00 PM") */}
      <div className="grid grid-cols-2 gap-3 px-1 py-1 mb-5 text-xs">
        <div>
          <span className="text-[11px] text-slate-400 block">Rate Limit:</span>
          <span className="font-mono font-medium text-slate-200">{tierInfo.maxRpm.toLocaleString()} RPM</span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 block">Latency & Relay:</span>
          <span className="font-mono font-medium text-emerald-400">{relayInfo.latency}</span>
        </div>
      </div>

      {/* Pricing / Plan line (matching "$359 / night" and "2-5 guests") */}
      <div className="flex items-baseline justify-between pt-2 pb-5 border-t border-white/10">
        <div>
          <div className="text-xl font-bold text-white font-mono">
            $0.00<span className="text-xs font-normal text-slate-400 font-sans"> / Dev Tier</span>
          </div>
          <p className="text-[11px] text-amber-300/90 font-mono">
            {tierInfo.quotaFormatted}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Encryption</span>
          <span className="text-xs font-mono font-medium text-slate-300">Quantum Ed25519</span>
        </div>
      </div>

      {/* If a key was just created, show instant preview with quick copy and test actions */}
      {createdKey ? (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Key Ready
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Active</span>
          </div>
          <div className="flex items-center justify-between bg-black/60 rounded-xl px-3 py-2 border border-white/10 gap-2 mb-2.5">
            <code className="text-xs font-mono text-emerald-300 truncate select-all">
              {createdKey.key}
            </code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPlayground(createdKey)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Test in Gateway</span>
            </button>
            <button
              onClick={onOpenTerminal}
              className="py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center justify-center gap-1.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Action Button (matching the full-width white button 'Reserve' in reference image) */}
      <button
        id="btn-generate-key-card"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 text-neutral-950 font-bold text-sm tracking-wide transition-all duration-200 shadow-[0_4px_25px_rgba(255,255,255,0.25)] hover:shadow-[0_4px_30px_rgba(255,255,255,0.4)] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <span>Provisioning Relay...</span>
          </>
        ) : (
          <span>{createdKey ? 'Generate Another Key' : 'Generate API Key'}</span>
        )}
      </button>
    </div>
  );
};
