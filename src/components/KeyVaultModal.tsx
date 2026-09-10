import React, { useState } from 'react';
import { X, Key, Copy, Check, Trash2, Plus, ShieldAlert, Cpu, Radio, Sparkles, Terminal } from 'lucide-react';
import { ApiKeyRecord } from '../types';
import { playTerminalBlip, playKeySuccess } from '../utils/sound';

interface KeyVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKeyRecord[];
  onOpenNewKey: () => void;
  onRevokeKey: (id: string) => void;
  onTestKey: (key: ApiKeyRecord) => void;
  onOpenTerminal: () => void;
}

export const KeyVaultModal: React.FC<KeyVaultModalProps> = ({
  isOpen,
  onClose,
  keys,
  onOpenNewKey,
  onRevokeKey,
  onTestKey,
  onOpenTerminal,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    playTerminalBlip(1050);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredKeys = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.tier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[#07090f] border border-amber-500/30 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d121c] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Martian Key Vault
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {keys.filter((k) => k.status === 'active').length} Active Keys · Quantum Encrypted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playTerminalBlip(850);
                onOpenNewKey();
              }}
              className="px-3.5 py-1.5 rounded-full bg-white text-neutral-900 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Key</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 bg-[#0a0d14] border-b border-white/5">
          <input
            type="text"
            placeholder="Search keys by name, hash, or tier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm bg-black/40 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/40 font-mono"
          />

          <button
            onClick={onOpenTerminal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-mono transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Manage via CLI</span>
          </button>
        </div>

        {/* Keys List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-3.5">
          {filteredKeys.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No matching API keys found.
            </div>
          ) : (
            filteredKeys.map((k) => {
              const quotaPercent = Math.min(100, Math.round((k.tokensUsed / k.monthlyQuota) * 100));
              const isRevoked = k.status === 'revoked';

              return (
                <div
                  key={k.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isRevoked
                      ? 'bg-red-950/10 border-red-500/20 opacity-60'
                      : 'bg-[#0b0f19] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm font-sans">{k.name}</span>
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                            isRevoked
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {k.status}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{k.id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-amber-400" />
                          {k.tier}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Radio className="w-3 h-3 text-cyan-400" />
                          {k.relayZone}
                        </span>
                        <span>·</span>
                        <span>Limit: {k.rpmLimit} RPM</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(k.id, k.key)}
                        disabled={isRevoked}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        title="Copy Key Secret"
                      >
                        {copiedId === k.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === k.id ? 'Copied' : 'Copy Key'}</span>
                      </button>

                      {!isRevoked && (
                        <>
                          <button
                            onClick={() => onTestKey(k)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Test</span>
                          </button>
                          <button
                            onClick={() => onRevokeKey(k.id)}
                            className="p-1.5 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-colors"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Key preview + Quota progress */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2.5 border-t border-white/5 text-xs font-mono">
                    <code className="text-slate-400 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 select-all truncate max-w-full sm:max-w-md">
                      {isRevoked ? '••••••••••••••••••••••••••••••••' : k.key}
                    </code>

                    <div className="w-full sm:w-56 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Quota: {(k.tokensUsed / 1_000_000).toFixed(1)}M / {(k.monthlyQuota / 1_000_000).toFixed(0)}M</span>
                        <span>{quotaPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                          style={{ width: `${quotaPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
