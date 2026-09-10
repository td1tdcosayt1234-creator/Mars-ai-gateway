/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import marsBgImage from './assets/images/mars_gateway_bg_1789040540420.jpg';
import { TopNav } from './components/TopNav';
import { HeroOverlay } from './components/HeroOverlay';
import { KeyGeneratorCard } from './components/KeyGeneratorCard';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { TerminalInterface } from './components/TerminalInterface';
import { MetricsDashboard } from './components/MetricsDashboard';
import { KeyVaultModal } from './components/KeyVaultModal';
import { PlaygroundModal } from './components/PlaygroundModal';
import { DocsModal } from './components/DocsModal';
import { KeyCreationModal } from './components/KeyCreationModal';
import { ApiKeyRecord, GatewayMetrics, ModelTier, RelayZone, RequestLog } from './types';
import { INITIAL_KEYS, INITIAL_METRICS, INITIAL_REQUEST_LOGS, MODEL_TIER_CONFIG } from './data/mockData';
import { toggleCosmicDrone, playTerminalBlip } from './utils/sound';

export default function App() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ares_mars_keys');
      return saved ? JSON.parse(saved) : INITIAL_KEYS;
    } catch {
      return INITIAL_KEYS;
    }
  });

  const [metrics, setMetrics] = useState<GatewayMetrics>(INITIAL_METRICS);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>(INITIAL_REQUEST_LOGS);
  const [isStreaming, setIsStreaming] = useState(true);
  const [audioActive, setAudioActive] = useState(false);

  // Active view states
  const [activeTab, setActiveTab] = useState<'home' | 'keys' | 'terminal' | 'telemetry' | 'docs'>('home');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isKeyVaultOpen, setIsKeyVaultOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [playgroundKey, setPlaygroundKey] = useState<ApiKeyRecord | null>(null);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);

  // Persist keys to local state
  useEffect(() => {
    try {
      localStorage.setItem('ares_mars_keys', JSON.stringify(keys));
    } catch {
      // ignore
    }
  }, [keys]);

  // Real-time metrics streaming engine (1.5s interval)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      setMetrics((prev) => {
        const deltaRps = (Math.random() - 0.48) * 8;
        const nextRps = Math.max(90, Math.min(280, prev.currentRps + deltaRps));
        const nextPeak = Math.max(prev.peakRps, nextRps);
        const nextLatency = 12 + Math.random() * 4.5;
        const nextTokensToday = prev.totalTokensToday + Math.floor(nextRps * (350 + Math.random() * 100));

        const newRpsHistory = [...prev.rpsHistory.slice(1), Math.round(nextRps)];
        const newTokensHistory = [
          ...prev.tokenThroughputHistory.slice(1),
          Math.round(nextRps * (6 + Math.random() * 1.5)),
        ];
        const newLatencyHistory = [...prev.latencyHistory.slice(1), parseFloat(nextLatency.toFixed(1))];

        return {
          ...prev,
          currentRps: nextRps,
          peakRps: nextPeak,
          totalTokensToday: nextTokensToday,
          totalRequestsToday: prev.totalRequestsToday + Math.floor(nextRps * 1.5),
          avgLatencyMs: nextLatency,
          rpsHistory: newRpsHistory,
          tokenThroughputHistory: newTokensHistory,
          latencyHistory: newLatencyHistory,
        };
      });

      // Stream simulated incoming request log
      const origins = [
        'Rover-Perseverance-02',
        'Curiosity-Deep-Sector',
        'Colony-Dome-Alpha',
        'Phobos-Relay-Hub',
        'Ingenuity-Drone-Fleet',
        'Olympus-Atmospheric-Lab',
        'Valles-Marineris-Array',
      ];
      const randomOrigin = origins[Math.floor(Math.random() * origins.length)];
      const randomTokens = Math.floor(120 + Math.random() * 850);
      const randomLat = 9.8 + Math.random() * 9.5;
      const now = new Date();
      const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      const newLog: RequestLog = {
        id: `req_${Date.now()}`,
        timestamp: timeStr,
        keyId: 'key_ares_01',
        keyName: 'Olympus Primary Hub',
        endpoint: '/v1/chat/completions',
        status: 200,
        latencyMs: randomLat,
        tokens: randomTokens,
        model: 'gemini-2.5-flash',
        origin: randomOrigin,
      };

      setRequestLogs((prev) => [newLog, ...prev.slice(0, 19)]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Key generator helper
  const handleGenerateKey = useCallback(
    (tier: ModelTier, relayZone: RelayZone, customName?: string): ApiKeyRecord => {
      const config = MODEL_TIER_CONFIG[tier];
      const randomHex = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const newKeySecret = `ak_mars_live_${randomHex}`;
      const newId = `key_ares_${Date.now().toString(36)}`;

      const record: ApiKeyRecord = {
        id: newId,
        name: customName || `Martian Unit (${tier.split('-')[0]})`,
        key: newKeySecret,
        tier,
        relayZone,
        createdAt: new Date().toISOString(),
        lastUsedAt: 'Never',
        status: 'active',
        tokensUsed: 0,
        requestCount: 0,
        monthlyQuota: parseInt(config.quotaFormatted) * 1_000_000 || 50_000_000,
        rpmLimit: config.maxRpm,
      };

      setKeys((prev) => [record, ...prev]);
      return record;
    },
    []
  );

  // Revoke key helper
  const handleRevokeKey = useCallback((keyId: string): boolean => {
    let found = false;
    setKeys((prev) =>
      prev.map((k) => {
        if (k.id === keyId || k.key.includes(keyId)) {
          found = true;
          return { ...k, status: 'revoked' };
        }
        return k;
      })
    );
    return found;
  }, []);

  // Handle Tab selections
  const handleSelectTab = (tab: 'home' | 'keys' | 'terminal' | 'telemetry' | 'docs') => {
    setActiveTab(tab);
    if (tab === 'keys') setIsKeyVaultOpen(true);
    if (tab === 'terminal') setIsTerminalOpen(true);
    if (tab === 'telemetry') setIsTelemetryOpen(true);
    if (tab === 'docs') setIsDocsOpen(true);
  };

  const handleToggleAudio = () => {
    const nextState = !audioActive;
    const ok = toggleCosmicDrone(nextState);
    setAudioActive(ok);
  };

  const handleOpenPlayground = (k: ApiKeyRecord) => {
    setPlaygroundKey(k);
    setIsPlaygroundOpen(true);
  };

  return (
    <main className="relative min-h-screen w-full bg-[#030407] text-slate-100 flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8 select-none font-sans overflow-x-hidden">
      {/* Outer ambient cosmic backdrop glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.08),_transparent_70%)]" />

      {/* 
        The Curved Outer Viewport Bezel
        Directly inspired by the rounded viewport frame in the user's reference image!
        Gives the sensation of looking through a futuristic spaceship / Mars observation window.
      */}
      <div className="relative w-full max-w-[1520px] min-h-[92vh] rounded-[24px] sm:rounded-[32px] md:rounded-[40px] border border-white/20 sm:border-white/25 shadow-[0_0_80px_rgba(0,0,0,0.9),_inset_0_0_30px_rgba(255,255,255,0.04)] overflow-hidden flex flex-col justify-between backdrop-blur-sm bg-black">
        {/* Background Image of Mars with warm glowing research habitat */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-100"
          style={{
            backgroundImage: `url(${marsBgImage})`,
          }}
        />

        {/* Cinematic Grading & Atmosphere Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_60%,_rgba(245,158,11,0.12),_transparent_60%)] pointer-events-none" />
        
        {/* Dynamic Canvas with Twinkling Stars & Drifting Martian Dust */}
        <StarfieldCanvas stormDensity={0.25} />

        {/* Top Navigation Bar */}
        <TopNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenNewKeyModal={() => setIsNewKeyModalOpen(true)}
          audioActive={audioActive}
          onToggleAudio={handleToggleAudio}
          keysCount={keys.filter((k) => k.status === 'active').length}
        />

        {/* Hero Section: Left Typography + Right Floating Generator Card */}
        <div className="relative z-20 flex-1 flex flex-col lg:flex-row items-center lg:items-end justify-between px-6 sm:px-10 md:px-14 lg:px-16 py-8 lg:py-12 gap-10">
          {/* Left: Bold Display Heading, Subtitle & Rating Badge */}
          <HeroOverlay
            onOpenTerminal={() => setIsTerminalOpen(true)}
            onOpenTelemetry={() => setIsTelemetryOpen(true)}
          />

          {/* Right: Floating Glassmorphic Card (matching Evergreen Lodge card from photo) */}
          <div className="w-full lg:w-auto flex justify-center lg:justify-end">
            <KeyGeneratorCard
              onGenerateKey={handleGenerateKey}
              onOpenTerminal={() => setIsTerminalOpen(true)}
              onOpenPlayground={handleOpenPlayground}
            />
          </div>
        </div>

        {/* Subtle Bottom Bar with Quick Toggles */}
        <footer className="relative z-20 flex flex-wrap items-center justify-between px-6 sm:px-10 md:px-14 py-4 text-xs font-mono text-slate-400/80 border-t border-white/5 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                playTerminalBlip(800);
                setIsTerminalOpen(true);
              }}
              className="flex items-center gap-1.5 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>&gt;_ Open Mars Terminal (ares-cli)</span>
            </button>
            <span className="hidden sm:inline text-white/20">|</span>
            <button
              onClick={() => {
                playTerminalBlip(750);
                setIsTelemetryOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <span>Telemetry: {metrics.currentRps.toFixed(0)} RPS</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Mars Relay Station #04 · Olympus Mons Hub</span>
            <span className="text-amber-400/80 font-bold">Sol 782</span>
          </div>
        </footer>
      </div>

      {/* Interactive Modals & Drawers */}
      <TerminalInterface
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        keys={keys}
        metrics={metrics}
        onGenerateKey={handleGenerateKey}
        onRevokeKey={handleRevokeKey}
      />

      <MetricsDashboard
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
        metrics={metrics}
        requestLogs={requestLogs}
        isStreaming={isStreaming}
        onToggleStreaming={() => setIsStreaming(!isStreaming)}
      />

      <KeyVaultModal
        isOpen={isKeyVaultOpen}
        onClose={() => setIsKeyVaultOpen(false)}
        keys={keys}
        onOpenNewKey={() => setIsNewKeyModalOpen(true)}
        onRevokeKey={handleRevokeKey}
        onTestKey={handleOpenPlayground}
        onOpenTerminal={() => {
          setIsKeyVaultOpen(false);
          setIsTerminalOpen(true);
        }}
      />

      <PlaygroundModal
        isOpen={isPlaygroundOpen}
        onClose={() => setIsPlaygroundOpen(false)}
        selectedKey={playgroundKey}
        keys={keys}
        onSelectKey={(k) => setPlaygroundKey(k)}
        onOpenTerminal={() => {
          setIsPlaygroundOpen(false);
          setIsTerminalOpen(true);
        }}
      />

      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        onOpenTerminal={() => {
          setIsDocsOpen(false);
          setIsTerminalOpen(true);
        }}
      />

      <KeyCreationModal
        isOpen={isNewKeyModalOpen}
        onClose={() => setIsNewKeyModalOpen(false)}
        onGenerateKey={handleGenerateKey}
        onOpenTerminal={() => {
          setIsNewKeyModalOpen(false);
          setIsTerminalOpen(true);
        }}
      />
    </main>
  );
}
