import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Play, Sparkles, Key, Activity } from 'lucide-react';
import { ApiKeyRecord, GatewayMetrics, ModelTier, RelayZone, TerminalEntry } from '../types';
import { playTerminalBlip, playKeySuccess } from '../utils/sound';
import { sanitizeInput, escapeHtml, auditLog } from '../utils/security';

interface TerminalInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKeyRecord[];
  metrics: GatewayMetrics;
  onGenerateKey: (tier: ModelTier, relayZone: RelayZone, name?: string) => ApiKeyRecord;
  onRevokeKey: (keyId: string) => boolean;
}

export const TerminalInterface: React.FC<TerminalInterfaceProps> = ({
  isOpen,
  onClose,
  keys,
  metrics,
  onGenerateKey,
  onRevokeKey,
}) => {
  const [entries, setEntries] = useState<TerminalEntry[]>([
    { id: 'init-1', timestamp: '11:42:01', type: 'system', content: '⚡ ARES NEURAL RELAY GATEWAY - CLI OS v3.8.4-mars (sol-782) [HARDENED]' },
    { id: 'init-2', timestamp: '11:42:01', type: 'system', content: '📡 Link established: Olympus Mons Sub-Relay #04 -> Earth DSN. Type "help" for commands. [Input sanitized, rate-limited]' },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastCmdTs = useRef<number>(0);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries]);
  if (!isOpen) return null;

  const appendEntry = (type: TerminalEntry['type'], content: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    // Truncate overly long content to prevent DoS
    const safe = content.slice(0, 4000);
    setEntries((prev) => [...prev.slice(-100), { id: `entry-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, timestamp: time, type, content: safe }]);
  };

  const handleCommand = (rawCmd: string) => {
    // Security: sanitize, limit length, block command injection patterns
    const rawSanitized = sanitizeInput(rawCmd, 500);
    if (!rawSanitized) return;
    // Rate limit: 400ms between commands
    const now = Date.now();
    if (now - lastCmdTs.current < 400) {
      appendEntry('error', 'Rate limited: slow down. 400ms cooldown.');
      return;
    }
    lastCmdTs.current = now;

    // Block injection characters that could indicate XSS or shell injection attempts
    const blockedPatterns = [/;\s*rm\s/i, /\|\s*sh/i, /\$\(/, /`.*`/, /<script/i, /javascript:/i, /onerror=/i];
    for (const pat of blockedPatterns) {
      if (pat.test(rawSanitized)) {
        appendEntry('error', `Blocked: suspicious pattern detected (${pat.source}). Input sanitized.`);
        auditLog('terminal_blocked', rawSanitized.slice(0, 50));
        return;
      }
    }

    const cmd = rawSanitized.trim();
    if (!cmd) return;
    playTerminalBlip(780);
    appendEntry('input', `ares@mars-relay:~$ ${escapeHtml(cmd).slice(0, 200)}`);
    setHistory((prev) => [cmd, ...prev.slice(0, 50)]);
    setHistoryIndex(-1);

    const parts = cmd.split(/\s+/);
    const mainCmd = parts[0].toLowerCase();
    const subCmd = parts[1]?.toLowerCase();

    switch (mainCmd) {
      case 'help': {
        appendEntry('output',
`Available Ares CLI Commands (Hardened):
  keys list                  List all provisioned Mars API keys & quotas
  keys new [name] [--tier]   Provision a new API key (e.g. keys new Rover01 --tier=flash)
  keys revoke <key_id>       Revoke an active key (e.g. keys revoke key_ares_01)
  keys test [prompt]         Simulate live AI inference over the Mars Gateway
  metrics                    Display live telemetry, RPS, latency & error rates
  ping <target>              Measure latency to earth, phobos, or olympus
  logs                       View recent request telemetry
  audit                      View local audit log (last actions)
  clear                      Clear terminal console
  status                     Martian orbital cluster health & Sol report`);
        break;
      }
      case 'clear': { setEntries([]); break; }
      case 'audit': {
        try {
          const raw = localStorage.getItem('ares_audit_log_v2');
          const logs = raw ? JSON.parse(raw) : [];
          if (logs.length===0) appendEntry('output','No audit entries.');
          else {
            let out='Audit Log (last 10):\n';
            logs.slice(-10).forEach((e:any)=>{ out+=` [${new Date(e.ts).toISOString().slice(11,19)}] ${e.action} :: ${e.detail}\n`; });
            appendEntry('output', out);
          }
        } catch { appendEntry('error','Audit log unavailable'); }
        break;
      }
      case 'keys': {
        if (!subCmd || subCmd === 'list') {
          let out = `Active API Key Registry (${keys.length} keys registered):\n`;
          out += `+-----------------------+----------------------+-------------------+------------+------------------+\n`;
          out += `| KEY ID                | ALIAS / NAME         | TIER              | STATUS     | USAGE / QUOTA    |\n`;
          out += `+-----------------------+----------------------+-------------------+------------+------------------+\n`;
          keys.forEach((k) => {
            const shortId = escapeHtml(k.id).slice(0,21).padEnd(21);
            const safeName = escapeHtml(k.name);
            const shortName = (safeName.length > 20 ? safeName.slice(0, 18) + '..' : safeName).padEnd(20);
            const shortTier = k.tier.slice(0, 17).padEnd(17);
            const statusStr = k.status.toUpperCase().padEnd(10);
            const usage = `${(k.tokensUsed / 1_000_000).toFixed(1)}M / ${(k.monthlyQuota / 1_000_000).toFixed(0)}M`.padEnd(16);
            out += `| ${shortId} | ${shortName} | ${shortTier} | ${statusStr} | ${usage} |\n`;
          });
          out += `+-----------------------+----------------------+-------------------+------------+------------------+`;
          appendEntry('output', out);
        } else if (subCmd === 'new' || subCmd === 'create' || subCmd === 'request') {
          let tier: ModelTier = 'gemini-2.5-flash';
          let zone: RelayZone = 'olympus-primary';
          const nameRaw = parts[2] && !parts[2].startsWith('--') ? parts[2] : 'CLI-Agent';
          const namePart = sanitizeInput(nameRaw, 32).replace(/[^a-zA-Z0-9\-_]/g,'').slice(0,20) || 'CLI-Agent';
          if (cmd.includes('--tier=pro')) tier = 'gemini-2.5-pro';
          if (cmd.includes('--tier=ares') || cmd.includes('--tier=70b')) tier = 'ares-neural-70b';
          if (cmd.includes('--tier=vision')) tier = 'deep-space-vision';
          if (cmd.includes('--zone=phobos')) zone = 'phobos-orbital';
          if (cmd.includes('--zone=chryse')) zone = 'chryse-ground';
          try {
            // Use secure suffix via crypto
            const suffix = (()=>{ const a=new Uint8Array(2); crypto.getRandomValues(a); return (a[0]*256+a[1])%900+100; })();
            const newKey = onGenerateKey(tier, zone, `${namePart}-${suffix}`);
            playKeySuccess();
            appendEntry('success',
`✔ SUCCESS: Provisioned new API key!
  Key ID:     ${newKey.id}
  Key Secret: ${newKey.key}
  Tier:       ${newKey.tier}
  Relay:      ${newKey.relayZone}
  Rate Limit: ${newKey.rpmLimit} RPM
  (Key added to Key Vault)`);
          } catch (e:any) {
            appendEntry('error', `Key generation failed: ${escapeHtml(e.message || 'rate limited')}`);
          }
        } else if (subCmd === 'revoke') {
          const targetId = sanitizeInput(parts[2]||'',128);
          if (!targetId) { appendEntry('error', 'Error: Missing key_id. Usage: keys revoke <key_id>'); return; }
          if (!/^[a-z0-9_\-]+$/i.test(targetId) && !targetId.startsWith('ak_mars')) {
            appendEntry('error','Error: Invalid key_id format'); return;
          }
          const success = onRevokeKey(targetId);
          if (success) appendEntry('success', `✔ Key "${escapeHtml(targetId).slice(0,40)}" has been revoked successfully.`);
          else appendEntry('error', `Error: Key "${escapeHtml(targetId).slice(0,40)}" not found or already revoked.`);
        } else if (subCmd === 'test') {
          const promptRaw = parts.slice(2).join(' ') || 'Analyze Martian atmospheric dust sample #8841.';
          const prompt = sanitizeInput(promptRaw, 300).slice(0,200);
          appendEntry('system', `📡 Transmitting test inference request to Mars Neural Core...`);
          appendEntry('system', `Prompt: "${escapeHtml(prompt)}"`);
          setTimeout(() => {
            playTerminalBlip(1100);
            appendEntry('output',
`[200 OK] Response received in 14.8ms via Olympus-Primary:
{
  "model": "gemini-2.5-flash@mars-cluster",
  "response": "Spectroscopic telemetry confirms 68.2% iron(III) oxide with low hydrate traces. Martian surface atmospheric pressure steady at 610 Pa.",
  "tokens": { "prompt": 18, "completion": 34, "total": 52 },
  "latency_breakdown": { "cluster_edge": "12.2ms", "relay_hop": "2.6ms" }
}`);
          }, 600);
        } else {
          appendEntry('error', `Unknown sub-command "keys ${escapeHtml(subCmd||'')}". Try "keys list", "keys new", "keys test", or "keys revoke".`);
        }
        break;
      }
      case 'metrics': {
        appendEntry('output',
`╔══════════════════════════════════════════════════════════╗
║              ARES REAL-TIME TELEMETRY REPORT             ║
╠══════════════════════════════════════════════════════════╣
  Current Throughput:    ${metrics.currentRps.toFixed(1)} requests/sec (Peak: ${metrics.peakRps.toFixed(1)})
  Total Inferences (24h):${metrics.totalRequestsToday.toLocaleString()} reqs
  Tokens Processed:      ${(metrics.totalTokensToday / 1_000_000).toFixed(2)} Million tokens
  Average Edge Latency:  ${metrics.avgLatencyMs.toFixed(1)} ms
  P99 Latency:           ${metrics.p99LatencyMs.toFixed(1)} ms
  Error Rate:            ${(metrics.errorRate * 100).toFixed(3)}%
  Mars <-> Earth Delay:  ~${metrics.earthMarsDelayMinutes} minutes (Light speed delay)
  Cluster Core Status:   ${metrics.clusterHealth.toUpperCase()} [All 16 Neural nodes nominal]
╚══════════════════════════════════════════════════════════╝`);
        break;
      }
      case 'ping': {
        const destRaw = sanitizeInput(parts[1]||'earth', 20).toLowerCase();
        const dest = destRaw.replace(/[^a-z]/g,'') || 'earth';
        if (dest === 'earth') {
          appendEntry('system', `PING earth.relay.nasa.gov (Deep Space Network):`);
          appendEntry('output', `64 bytes from earth-dsn-canberra: time=4m 12s (speed of light barrier: 247,000 km/s)`);
          appendEntry('output', `Tip: Use local Martian Gateway endpoints for sub-15ms inference!`);
        } else if (dest === 'phobos' || dest === 'olympus' || dest === 'local') {
          appendEntry('system', `PING ${dest}.mars-internal.net:`);
          appendEntry('output', `64 bytes from ${dest}-node-01: icmp_seq=1 ttl=64 time=11.4 ms`);
          appendEntry('output', `64 bytes from ${dest}-node-01: icmp_seq=2 ttl=64 time=10.9 ms`);
          appendEntry('success', `✔ Local Martian packet roundtrip: 11.1ms avg, 0% packet loss.`);
        } else {
          appendEntry('output', `PING ${escapeHtml(dest)}: Destination reachable via orbital relay. Latency: 13.8ms.`);
        }
        break;
      }
      case 'logs': {
        appendEntry('output',
`Recent Gateway Stream (Last 4 requests):
  [11:43:02] 200 OK | POST /v1/chat/completions | Rover-Curiosity-04 | 14.1ms | 412 tok
  [11:43:01] 200 OK | POST /v1/embeddings       | Colony-Dome-Alpha   |  6.2ms | 128 tok
  [11:42:59] 200 OK | POST /v1/generateContent  | Phobos-Orbital-Scan | 22.8ms | 940 tok
  [11:42:58] 200 OK | POST /v1/chat/completions | Olympus-Base-Drill  | 13.4ms | 256 tok`);
        break;
      }
      case 'status': {
        appendEntry('output',
`MARS PLANETARY COMPUTING CLUSTER STATUS:
  - Planetary Location: Chryse Planitia / Olympus Mons Uplink
  - Solar Day (Sol): 782
  - Battery/Nuclear Core: 98.4% Nominal
  - Active API Keys: ${keys.filter((k) => k.status === 'active').length} of ${keys.length}
  - Neural Accelerator: 128x TPU-v5 Orbital equivalents operational
  - Security: HARDENED (CSP, AES-GCM, rate-limited)`);
        break;
      }
      default:
        appendEntry('error', `Command not found: "${escapeHtml(cmd).slice(0,40)}". Type "help" for a list of commands.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleCommand(inputVal); setInputVal(''); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1; setHistoryIndex(nextIdx); setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1; setHistoryIndex(nextIdx); setInputVal(history[nextIdx]);
      } else if (historyIndex === 0) { setHistoryIndex(-1); setInputVal(''); }
    }
  };
  const executePreset = (cmd: string) => { handleCommand(cmd); inputRef.current?.focus(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative flex flex-col bg-[#05070c] border border-amber-500/30 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden transition-all duration-300 ${isExpanded ? 'w-full h-full max-w-6xl max-h-[92vh]' : 'w-full max-w-3xl h-[620px] max-h-[88vh]'}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d111a] border-b border-white/10 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold tracking-wide text-slate-200">ares-cli :: mars-terminal@sol-782 [SECURE]</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">{isExpanded ? <Maximize2 className="w-4 h-4 rotate-180" /> : <Maximize2 className="w-4 h-4" />}</button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#090d14] border-b border-white/5 overflow-x-auto scrollbar-none text-[11px] font-mono">
          <span className="text-slate-500 flex items-center gap-1 shrink-0"><Play className="w-3 h-3 text-amber-500" /> Run:</span>
          <button onClick={() => executePreset('keys list')} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300 transition-colors shrink-0 flex items-center gap-1"><Key className="w-3 h-3 text-amber-400" /> keys list</button>
          <button onClick={() => executePreset('keys new Rover-Alpha --tier=flash')} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-emerald-300 transition-colors shrink-0 flex items-center gap-1"><Sparkles className="w-3 h-3 text-emerald-400" /> keys new (flash)</button>
          <button onClick={() => executePreset('keys test "Scan Mars crater telemetry"')} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors shrink-0">keys test</button>
          <button onClick={() => executePreset('metrics')} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300 transition-colors shrink-0 flex items-center gap-1"><Activity className="w-3 h-3 text-amber-400" /> metrics</button>
          <button onClick={() => executePreset('audit')} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0">audit</button>
          <button onClick={() => executePreset('clear')} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors shrink-0">clear</button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs sm:text-[13px] space-y-2 select-text bg-[#05070c]">
          {entries.map((entry) => {
            if (entry.type === 'input') return <div key={entry.id} className="text-amber-300 font-semibold flex items-start gap-2"><span className="text-slate-500 select-none">[{entry.timestamp}]</span><span>{entry.content}</span></div>;
            if (entry.type === 'error') return <div key={entry.id} className="text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 whitespace-pre-wrap">{entry.content}</div>;
            if (entry.type === 'success') return <div key={entry.id} className="text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 whitespace-pre-wrap">{entry.content}</div>;
            if (entry.type === 'system') return <div key={entry.id} className="text-cyan-400/90 whitespace-pre-wrap">{entry.content}</div>;
            return <div key={entry.id} className="text-slate-300 whitespace-pre-wrap leading-relaxed">{entry.content}</div>;
          })}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0e17] border-t border-white/10">
          <span className="text-emerald-400 font-mono text-xs sm:text-sm font-bold select-none shrink-0">ares@mars-relay:~$</span>
          <input ref={inputRef} type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value.slice(0,500))} onKeyDown={handleKeyDown} placeholder="Type 'help', 'keys list', 'audit'..." maxLength={500} className="flex-1 bg-transparent text-slate-100 font-mono text-xs sm:text-sm focus:outline-none placeholder:text-slate-600" autoComplete="off" spellCheck={false} />
          <button onClick={() => { if (inputVal.trim()) { handleCommand(inputVal); setInputVal(''); } }} className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono text-xs font-semibold transition-colors">Execute</button>
        </div>
      </div>
    </div>
  );
};
