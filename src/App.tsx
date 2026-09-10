/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TerminalInterface } from './components/TerminalInterface';
import { KeyVaultModal } from './components/KeyVaultModal';
import { PlaygroundModal } from './components/PlaygroundModal';
import { DocsModal } from './components/DocsModal';
import { KeyCreationModal } from './components/KeyCreationModal';
import { ApiKeyRecord, GatewayMetrics, ModelTier, RelayZone, RequestLog } from './types';
import { INITIAL_KEYS, INITIAL_METRICS, INITIAL_REQUEST_LOGS, MODEL_TIER_CONFIG } from './data/mockData';
import { toggleCosmicDrone, playTerminalBlip } from './utils/sound';

import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { ModelsPage } from './pages/ModelsPage';
import { LoginPage } from './pages/LoginPage';

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
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
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
    <Router>
      <Routes>
        <Route element={
          <Layout 
            keysCount={keys.filter((k) => k.status === 'active').length}
            audioActive={audioActive}
            handleToggleAudio={handleToggleAudio}
            setIsNewKeyModalOpen={setIsNewKeyModalOpen}
            setIsTerminalOpen={setIsTerminalOpen}
            setIsTelemetryOpen={() => { /* no-op since it's a page now */ }}
            metrics={metrics}
          />
        }>
          <Route path="/" element={
            <HomePage 
              setIsTerminalOpen={setIsTerminalOpen}
              setIsTelemetryOpen={() => { /* no-op */ }}
              handleGenerateKey={handleGenerateKey}
              handleOpenPlayground={handleOpenPlayground}
            />
          } />
          
          <Route path="/models" element={<ModelsPage />} />
          
          <Route path="/dashboard" element={
            <DashboardPage 
              metrics={metrics}
              requestLogs={requestLogs}
              isStreaming={isStreaming}
              setIsStreaming={setIsStreaming}
              keys={keys}
              handleOpenPlayground={handleOpenPlayground}
              setIsTerminalOpen={setIsTerminalOpen}
            />
          } />
          
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Interactive Modals & Drawers */}
      <TerminalInterface
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        keys={keys}
        metrics={metrics}
        onGenerateKey={handleGenerateKey}
        onRevokeKey={handleRevokeKey}
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
    </Router>
  );
}
