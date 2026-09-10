import React, { useState } from 'react';
import { X, Send, Sparkles, Copy, Check, Terminal, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ApiKeyRecord } from '../types';
import { playTerminalBlip, playKeySuccess } from '../utils/sound';
import { sanitizeInput, isValidPrompt, escapeHtml, auditLog } from '../utils/security';

interface PlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKey: ApiKeyRecord | null;
  keys: ApiKeyRecord[];
  onSelectKey: (k: ApiKeyRecord) => void;
  onOpenTerminal: () => void;
}

export const PlaygroundModal: React.FC<PlaygroundModalProps> = ({
  isOpen,
  onClose,
  selectedKey,
  keys,
  onSelectKey,
  onOpenTerminal,
}) => {
  const [prompt, setPrompt] = useState('Identify mineral deposits in Jezero Crater sector Delta-7 using spectral imagery.');
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [latencyBreakdown, setLatencyBreakdown] = useState<{ edge: number; total: number; tokens: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;
  const activeKey = selectedKey || keys.find((k) => k.status === 'active') || keys[0];
  if (!activeKey) return null;

  const handleSend = () => {
    setError(null);
    const clean = sanitizeInput(prompt, 2000);
    if (!clean || clean.length < 2) { setError('Prompt too short'); return; }
    if (!isValidPrompt(clean)) { setError('Prompt must be 2-2000 chars'); return; }
    // Block injection
    if (/<script|javascript:|onerror=/i.test(clean)) { setError('Blocked: suspicious prompt content'); auditLog('playground_blocked','xss attempt'); return; }
    if (isLoading) return;
    setIsLoading(true);
    setResponseOutput(null);
    playTerminalBlip(750);
    setTimeout(() => {
      setIsLoading(false);
      playKeySuccess();
      auditLog('playground_inference', `${activeKey.tier} len=${clean.length}`);
      const responses: Record<string, string> = {
        'gemini-2.5-flash': 'Analysis of Jezero Crater Delta-7 reveals high concentrations of phyllosilicates (smectite-group clays) and olivine-bearing sandstones. Carbonate signatures detected in the southwest escarpment indicate ancient lacustrine deposition.',
        'gemini-2.5-pro': 'Multi-spectral matrix synthesis:\n1. Olivine carbonate units identified at coordinates 18.38° N, 77.58° E.\n2. Hydrated silica detected along western fan front.\n3. Recommendation: Deploy rover core drill at sample target site "Belva Crater Rim #04". Surface hardness estimated 4.2 Mohs.',
        'ares-neural-70b': 'MARTIAN HABITAT NEURAL SUBSYSTEM REPORT:\nAutonomous sample evaluation complete. Spectral reflectance curves match Martian basalt with partial palagonite weathering. Radiation shielding effectiveness verified at 94.2%.',
        'deep-space-vision': 'Orbital Synthetic Aperture Radar (SAR) pass verified:\nSubsurface crater depth: 612 meters.\nRegolith density: 1.52 g/cm³.\nZero subsurface ice voids detected within top 4 meters.',
      };
      setResponseOutput(responses[activeKey.tier] || responses['gemini-2.5-flash']);
      // Use secure random for latency display (still not security critical but consistent)
      const a1 = new Uint8Array(2); crypto.getRandomValues(a1);
      const a2 = new Uint8Array(2); crypto.getRandomValues(a2);
      setLatencyBreakdown({
        edge: 11.4 + (a1[0]/255)*4,
        total: 14.8 + (a2[0]/255)*5,
        tokens: Math.floor(45 + (a1[1]/255)*60),
      });
    }, 650);
  };

  // Sanitize prompt for curl: escape quotes and limit
  const safePromptForCurl = sanitizeInput(prompt, 1000).replace(/"/g, '\\"').replace(/`/g,'').replace(/\$/g,'');
  const curlCommand = `curl https://mars-gateway.ares.internal/v1/chat/completions \\
  -H "Authorization: Bearer ${escapeHtml(activeKey.key).slice(0,60)}..." \\
  -H "X-Mars-Relay: ${activeKey.relayZone}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${activeKey.tier}",
    "messages": [{"role": "user", "content": "${safePromptForCurl.slice(0,120)}"}]
  }'`;

  const handleCopyCurl = async () => {
    try { await navigator.clipboard.writeText(curlCommand); setCopiedCurl(true); playTerminalBlip(950); setTimeout(()=>setCopiedCurl(false),2000); }
    catch { setError('Clipboard blocked'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-[#07090f] border border-amber-500/30 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d121c] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400"><Sparkles className="w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">Mars Gateway API Playground <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SANITIZED</span></h2><p className="text-xs text-slate-400 font-mono">Test planetary inference over Olympus & Chryse relays • Input validated</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0d111a] border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Authenticating with:</span>
              <select value={activeKey.id} onChange={(e)=>{ const f=keys.find((k)=>k.id===e.target.value); if(f) onSelectKey(f); }} className="bg-black/50 border border-white/10 rounded-xl px-3 py-1 text-xs font-semibold text-amber-300 font-mono focus:outline-none">
                {keys.map((k)=> <option key={k.id} value={k.id} disabled={k.status==='revoked'}>{escapeHtml(k.name)} ({k.tier}) {k.status==='revoked' ? '[REVOKED]' : ''}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400"><span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" />Verified Active</span><span>·</span><span>Relay: {activeKey.relayZone}</span></div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between"><span>Inference Prompt Payload:</span><span className="text-slate-500 font-sans text-[11px]">Max 2000 chars • Sanitized • Sub-15ms</span></label>
            <div className="relative">
              <textarea value={prompt} onChange={(e)=> { setPrompt(e.target.value.slice(0,2000)); setError(null); }} rows={3} maxLength={2000} className="w-full bg-[#04060a] border border-white/10 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 font-mono leading-relaxed" placeholder="Enter prompt to execute on Martian Neural Cluster..." />
              <button onClick={handleSend} disabled={isLoading} className="absolute bottom-3 right-3 px-4 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-neutral-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-60 cursor-pointer">
                {isLoading ? <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isLoading ? 'Transmitting...' : 'Send Request'}</span>
              </button>
            </div>
            <div className="flex justify-between text-[10px] font-mono"><span className={prompt.length>1800? 'text-amber-400':'text-slate-500'}>{prompt.length}/2000</span>{error && <span className="text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/>{error}</span>}</div>
          </div>

          {responseOutput && (
            <div className="p-4 rounded-2xl bg-[#090d16] border border-emerald-500/30 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-mono"><span className="text-emerald-400 font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />[200 OK] Gateway Response (Sanitized)</span>{latencyBreakdown && <span className="text-slate-400">Cluster Latency: <strong className="text-emerald-400">{latencyBreakdown.total.toFixed(1)}ms</strong> · {latencyBreakdown.tokens} tokens</span>}</div>
              <p className="text-xs sm:text-sm text-slate-200 font-mono leading-relaxed whitespace-pre-wrap bg-black/40 p-3.5 rounded-xl border border-white/5">{escapeHtml(responseOutput)}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400"><span>cURL Integration Snippet (Redacted):</span><button onClick={handleCopyCurl} className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">{copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span></button></div>
            <pre className="p-3.5 rounded-xl bg-black/60 border border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed select-all">{curlCommand}</pre>
            <p className="text-[10px] font-mono text-slate-500">Secret truncated for display • Use copy-vault for full key • CSP protected</p>
          </div>
        </div>
      </div>
    </div>
  );
};
