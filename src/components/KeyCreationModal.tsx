import React, { useState } from 'react';
import { X, Sparkles, Cpu, Radio, Shield, Copy, Check, Terminal, ShieldAlert } from 'lucide-react';
import { ModelTier, RelayZone, ApiKeyRecord } from '../types';
import { MODEL_TIER_CONFIG, RELAY_ZONES } from '../data/mockData';
import { playTerminalBlip, playKeySuccess } from '../utils/sound';
import { sanitizeInput, isValidTier, isValidRelay } from '../utils/security';

interface KeyCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateKey: (tier: ModelTier, relayZone: RelayZone, name?: string) => ApiKeyRecord;
  onOpenTerminal: () => void;
}

export const KeyCreationModal: React.FC<KeyCreationModalProps> = ({
  isOpen,
  onClose,
  onGenerateKey,
  onOpenTerminal,
}) => {
  const [name, setName] = useState('');
  const [selectedTier, setSelectedTier] = useState<ModelTier>('gemini-2.5-flash');
  const [selectedRelay, setSelectedRelay] = useState<RelayZone>('olympus-primary');
  const [newKey, setNewKey] = useState<ApiKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = sanitizeInput(name, 64);
    if (cleanName.length < 2) { setError('Name must be 2-64 chars, alphanumeric only'); return; }
    if (!/^[a-zA-Z0-9\s\-_\.\(\)]+$/.test(cleanName)) { setError('Name contains invalid characters'); return; }
    if (!isValidTier(selectedTier) || !isValidRelay(selectedRelay)) { setError('Invalid tier/relay'); return; }
    setIsSubmitting(true);
    playTerminalBlip(750);
    setTimeout(() => {
      try {
        const generated = onGenerateKey(selectedTier, selectedRelay, cleanName || `Unit-${selectedTier.split('-')[0].toUpperCase()}`);
        setNewKey(generated);
        playKeySuccess();
      } catch (err:any) {
        setError(err?.message || 'Rate limited — wait 2s between keys');
        playTerminalBlip(250);
      } finally { setIsSubmitting(false); }
    }, 400);
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try { await navigator.clipboard.writeText(newKey.key); setCopied(true); playTerminalBlip(1100); setTimeout(()=>setCopied(false),2000); }
    catch { setError('Clipboard blocked — copy manually'); }
  };
  const resetModal = () => { setNewKey(null); setName(''); setError(null); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-lg bg-[#07090f] border border-amber-500/30 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d121c] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400"><Sparkles className="w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-white tracking-tight">Request Martian API Key</h2><p className="text-xs text-slate-400 font-mono">Provision instant credentials on Ares Gateway • Encrypted</p></div>
          </div>
          <button onClick={resetModal} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {newKey ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm"><Shield className="w-4 h-4" /><span>Key Provisioned Successfully! (AES-GCM)</span></div>
                <p className="text-xs text-slate-300">Save your secret key now. It is configured for {newKey.rpmLimit} requests/min on the {newKey.relayZone} relay. Stored encrypted at rest.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Secret Key:</label>
                <div className="flex items-center justify-between bg-black/60 rounded-xl px-3.5 py-2.5 border border-white/10 gap-2">
                  <code className="text-xs font-mono text-emerald-300 truncate select-all">{newKey.key}</code>
                  <button onClick={handleCopy} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors shrink-0" title="Copy Key">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
                </div>
              </div>
              {error && <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs font-mono text-red-300 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/>{error}</div>}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={resetModal} className="flex-1 py-3 rounded-full bg-white hover:bg-slate-200 text-neutral-900 font-bold text-xs transition-colors cursor-pointer">Done</button>
                <button onClick={() => { resetModal(); onOpenTerminal(); }} className="py-3 px-4 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono text-xs transition-colors flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /><span>View in CLI</span></button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Key Alias / Agent Name</label>
                <input type="text" required value={name} onChange={(e)=>{ setName(e.target.value.slice(0,64)); setError(null); }} placeholder="e.g., Perseverance Geological Spectrometer" maxLength={64} pattern="[a-zA-Z0-9\s\-_\.\(\)]+" className="w-full bg-[#05080f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 font-mono" />
                <p className="text-[10px] font-mono text-slate-500">2-64 chars, alphanumeric, dash, underscore only. Sanitized.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-amber-400" /><span>Model Tier</span></label>
                <select value={selectedTier} onChange={(e)=> setSelectedTier(e.target.value as ModelTier)} className="w-full bg-[#05080f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/40 font-mono">
                  {Object.entries(MODEL_TIER_CONFIG).map(([key, config]) => <option key={key} value={key} className="bg-neutral-900 text-white">{config.label} ({config.pricing})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-emerald-400" /><span>Mars Relay Station</span></label>
                <select value={selectedRelay} onChange={(e)=> setSelectedRelay(e.target.value as RelayZone)} className="w-full bg-[#05080f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/40 font-mono">
                  {Object.entries(RELAY_ZONES).map(([key, config]) => <option key={key} value={key} className="bg-neutral-900 text-white">{config.name} (Latency: {config.latency})</option>)}
                </select>
              </div>
              {error && <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs font-mono text-red-300 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/>{error}</div>}
              <button type="submit" disabled={isSubmitting} className="w-full mt-3 py-3.5 rounded-full bg-white hover:bg-slate-200 text-neutral-900 font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 cursor-pointer">
                {isSubmitting ? <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-600" />}
                <span>{isSubmitting ? 'Minting ED25519 Key...' : 'Provision Key'}</span>
              </button>
              <p className="text-center text-[10px] font-mono text-slate-500">Secure RNG • AES-GCM • Rate-limited 2s • Sanitized input</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
