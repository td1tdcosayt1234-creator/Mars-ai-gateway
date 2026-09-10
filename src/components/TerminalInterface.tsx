import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Play, Sparkles, Key, Activity, RefreshCw } from 'lucide-react';
import { ApiKeyRecord, GatewayMetrics, ModelTier, RelayZone, TerminalEntry } from '../types';
import { playTerminalBlip, playKeySuccess } from '../utils/sound';

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
    {
      id: 'init-1',
      timestamp: '11:42:01',
      type: 'system',
      content: '⚡ ARES NEURAL RELAY GATEWAY - CLI OS v3.8.4-mars (sol-782)',
    },
    {
      id: 'init-2',
      timestamp: '11:42:01',
      type: 'system',
      content: '📡 Link established: Olympus Mons Sub-Relay #04 -> Earth DSN. Type "help" for commands.',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (!isOpen) return null;

  const appendEntry = (type: TerminalEntry['type'], content: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setEntries((prev) => [...prev, { id: `entry-${Date.now()}-${Math.random()}`, timestamp: time, type, content }]);
  };

  const handleCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    playTerminalBlip(780);
    appendEntry('input', `ares@mars-relay:~$ ${cmd}`);
    setHistory((prev) => [cmd, ...prev]);
    setHistoryIndex(-1);

    const parts = cmd.split(' ');
    const mainCmd = parts[0].toLowerCase();
    const subCmd = parts[1]?.toLowerCase();

    switch (mainCmd) {
      case 'help': {
        appendEntry(
          'output',
          `Available Ares CLI Commands:
  keys list                  List all provisioned Mars API keys & quotas
  keys new [name] [--tier]   Provision a new API key (e.g. keys new Rover01 --tier=flash)
  keys revoke <key_id>       Revoke an active key (e.g. keys revoke key_ares_01)
  keys test [prompt]         Simulate live AI inference over the Mars Gateway
  metrics                    Display live telemetry, RPS, latency & error rates
  ping <target>              Measure latency to earth, phobos, or olympus
  logs                       View recent request telemetry
  clear                      Clear terminal console
  status                     Martian orbital cluster health & Sol report`
        );
        break;
      }

      case 'clear': {
        setEntries([]);
        break;
      }

      case 'keys': {
        if (!subCmd || subCmd === 'list') {
          let out = `Active API Key Registry (${keys.length} keys registered):\n`;
          out += `+-----------------------+----------------------+-------------------+------------+------------------+\n`;
          out += `| KEY ID                | ALIAS / NAME         | TIER              | STATUS     | USAGE / QUOTA    |\n`;
          out += `+-----------------------+----------------------+-------------------+------------+------------------+\n`;
          keys.forEach((k) => {
            const shortId = k.id.padEnd(21);
            const shortName = (k.name.length > 20 ? k.name.slice(0, 18) + '..' : k.name).padEnd(20);
            const shortTier = k.tier.slice(0, 17).padEnd(17);
            const statusStr = k.status.toUpperCase().padEnd(10);
            const usage = `${(k.tokensUsed / 1_000_000).toFixed(1)}M / ${(k.monthlyQuota / 1_000_000).toFixed(0)}M`.padEnd(16);
            out += `| ${shortId} | ${shortName} | ${shortTier} | ${statusStr} | ${usage} |\n`;
          });
          out += `+-----------------------+----------------------+-------------------+------------+------------------+`;
          appendEntry('output', out);
        } else if (subCmd === 'new' || subCmd === 'create' || subCmd === 'request') {
          // Parse options
          let tier: ModelTier = 'gemini-2.5-flash';
          let zone: RelayZone = 'olympus-primary';
          const namePart = parts[2] && !parts[2].startsWith('--') ? parts[2] : 'CLI-Agent';

          if (cmd.includes('--tier=pro')) tier = 'gemini-2.5-pro';
          if (cmd.includes('--tier=ares') || cmd.includes('--tier=70b')) tier = 'ares-neural-70b';
          if (cmd.includes('--tier=vision')) tier = 'deep-space-vision';
          if (cmd.includes('--zone=phobos')) zone = 'phobos-orbital';
          if (cmd.includes('--zone=chryse')) zone = 'chryse-ground';

          const newKey = onGenerateKey(tier, zone, `${namePart}-${Math.floor(100 + Math.random() * 900)}`);
          playKeySuccess();
          appendEntry(
            'success',
            `✔ SUCCESS: Provisioned new API key!\n  Key ID:     ${newKey.id}\n  Key Secret: ${newKey.key}\n  Tier:       ${newKey.tier}\n  Relay:      ${newKey.relayZone}\n  Rate Limit: ${newKey.rpmLimit} RPM\n  (Key added to Key Vault)`
          );
        } else if (subCmd === 'revoke') {
          const targetId = parts[2];
          if (!targetId) {
            appendEntry('error', 'Error: Missing key_id. Usage: keys revoke <key_id>');
            return;
          }
          const success = onRevokeKey(targetId);
          if (success) {
            appendEntry('success', `✔ Key "${targetId}" has been revoked successfully.`);
          } else {
            appendEntry('error', `Error: Key "${targetId}" not found or already revoked.`);
          }
        } else if (subCmd === 'test') {
          const prompt = parts.slice(2).join(' ') || 'Analyze Martian atmospheric dust sample #8841.';
          appendEntry('system', `📡 Transmitting test inference request to Mars Neural Core...`);
          appendEntry('system', `Prompt: "${prompt}"`);

          setTimeout(() => {
            playTerminalBlip(1100);
            appendEntry(
              'output',
              `[200 OK] Response received in 14.8ms via Olympus-Primary:
{
  "model": "gemini-2.5-flash@mars-cluster",
  "response": "Spectroscopic telemetry confirms 68.2% iron(III) oxide with low hydrate traces. Martian surface atmospheric pressure steady at 610 Pa.",
  "tokens": { "prompt": 18, "completion": 34, "total": 52 },
  "latency_breakdown": { "cluster_edge": "12.2ms", "relay_hop": "2.6ms" }
}`
            );
          }, 600);
        } else {
          appendEntry('error', `Unknown sub-command "keys ${subCmd}". Try "keys list", "keys new", "keys test", or "keys revoke".`);
        }
        break;
      }

      case 'metrics': {
        appendEntry(
          'output',
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
╚══════════════════════════════════════════════════════════╝`
        );
        break;
      }

      case 'ping': {
        const dest = parts[1]?.toLowerCase() || 'earth';
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
          appendEntry('output', `PING ${dest}: Destination reachable via orbital relay. Latency: 13.8ms.`);
        }
        break;
      }

      case 'logs': {
        appendEntry(
          'output',
          `Recent Gateway Stream (Last 4 requests):
  [11:43:02] 200 OK | POST /v1/chat/completions | Rover-Curiosity-04 | 14.1ms | 412 tok
  [11:43:01] 200 OK | POST /v1/embeddings       | Colony-Dome-Alpha   |  6.2ms | 128 tok
  [11:42:59] 200 OK | POST /v1/generateContent  | Phobos-Orbital-Scan | 22.8ms | 940 tok
  [11:42:58] 200 OK | POST /v1/chat/completions | Olympus-Base-Drill  | 13.4ms | 256 tok`
        );
        break;
      }

      case 'status': {
        appendEntry(
          'output',
          `MARS PLANETARY COMPUTING CLUSTER STATUS:
  - Planetary Location: Chryse Planitia / Olympus Mons Uplink
  - Solar Day (Sol): 782
  - Battery/Nuclear Core: 98.4% Nominal
  - Active API Keys: ${keys.filter((k) => k.status === 'active').length} of ${keys.length}
  - Neural Accelerator: 128x TPU-v5 Orbital equivalents operational`
        );
        break;
      }

      default:
        appendEntry('error', `Command not found: "${cmd}". Type "help" for a list of commands.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(inputVal);
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const executePreset = (cmd: string) => {
    handleCommand(cmd);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative flex flex-col bg-[#05070c] border border-amber-500/30 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden transition-all duration-300 ${
          isExpanded ? 'w-full h-full max-w-6xl max-h-[92vh]' : 'w-full max-w-3xl h-[620px] max-h-[88vh]'
        }`}
      >
        {/* Terminal Header Bar */}
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
              <span className="text-xs font-mono font-bold tracking-wide text-slate-200">
                ares-cli :: mars-terminal@sol-782
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={isExpanded ? 'Restore window' : 'Maximize window'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
              title="Close terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Command Pills for easy 1-click execution */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#090d14] border-b border-white/5 overflow-x-auto scrollbar-none text-[11px] font-mono">
          <span className="text-slate-500 flex items-center gap-1 shrink-0">
            <Play className="w-3 h-3 text-amber-500" /> Run:
          </span>
          <button
            onClick={() => executePreset('keys list')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300 transition-colors shrink-0 flex items-center gap-1"
          >
            <Key className="w-3 h-3 text-amber-400" /> keys list
          </button>
          <button
            onClick={() => executePreset('keys new Rover-Alpha --tier=flash')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-emerald-300 transition-colors shrink-0 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" /> keys new (flash)
          </button>
          <button
            onClick={() => executePreset('keys test "Scan Mars crater telemetry"')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors shrink-0"
          >
            keys test
          </button>
          <button
            onClick={() => executePreset('metrics')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300 transition-colors shrink-0 flex items-center gap-1"
          >
            <Activity className="w-3 h-3 text-amber-400" /> metrics
          </button>
          <button
            onClick={() => executePreset('ping phobos')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0"
          >
            ping phobos
          </button>
          <button
            onClick={() => executePreset('ping earth')}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0"
          >
            ping earth
          </button>
          <button
            onClick={() => executePreset('clear')}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors shrink-0"
          >
            clear
          </button>
        </div>

        {/* Terminal Screen Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs sm:text-[13px] space-y-2 select-text bg-[#05070c]">
          {entries.map((entry) => {
            if (entry.type === 'input') {
              return (
                <div key={entry.id} className="text-amber-300 font-semibold flex items-start gap-2">
                  <span className="text-slate-500 select-none">[{entry.timestamp}]</span>
                  <span>{entry.content}</span>
                </div>
              );
            }
            if (entry.type === 'error') {
              return (
                <div key={entry.id} className="text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 whitespace-pre-wrap">
                  {entry.content}
                </div>
              );
            }
            if (entry.type === 'success') {
              return (
                <div key={entry.id} className="text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 whitespace-pre-wrap">
                  {entry.content}
                </div>
              );
            }
            if (entry.type === 'system') {
              return (
                <div key={entry.id} className="text-cyan-400/90 whitespace-pre-wrap">
                  {entry.content}
                </div>
              );
            }
            return (
              <div key={entry.id} className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                {entry.content}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Command Input Prompt */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0e17] border-t border-white/10">
          <span className="text-emerald-400 font-mono text-xs sm:text-sm font-bold select-none shrink-0">
            ares@mars-relay:~$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type 'help', 'keys list', 'keys new', 'metrics'..."
            className="flex-1 bg-transparent text-slate-100 font-mono text-xs sm:text-sm focus:outline-none placeholder:text-slate-600"
            autoFocus
          />
          <button
            onClick={() => {
              if (inputVal.trim()) {
                handleCommand(inputVal);
                setInputVal('');
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono text-xs font-semibold transition-colors"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
};
