/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hardened Mars AI Gateway - Security Edition
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { TerminalInterface } from './components/TerminalInterface';
import { KeyVaultModal } from './components/KeyVaultModal';
import { PlaygroundModal } from './components/PlaygroundModal';
import { DocsModal } from './components/DocsModal';
import { KeyCreationModal } from './components/KeyCreationModal';
import { ApiKeyRecord, GatewayMetrics, ModelTier, RelayZone, RequestLog } from './types';
import { INITIAL_KEYS, INITIAL_METRICS, INITIAL_REQUEST_LOGS, MODEL_TIER_CONFIG } from './data/mockData';
import { toggleCosmicDrone } from './utils/sound';

import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { ModelsPage } from './pages/ModelsPage';
import { LoginPage } from './pages/LoginPage';
import { AIGovernance } from './components/AIGovernance';
import {
  isSessionValid,
  clearSession,
  setupActivityTracking,
  generateSecureApiKey,
  canGenerateKey,
  recordKeyGeneration,
  isValidTier,
  isValidRelay,
  sanitizeInput,
  SECURITY_CONFIG,
  secureSetItem,
  secureGetItem,
  auditLog,
} from './utils/security';

// ---------------------------------------------------------------------------
// Protected Route Wrapper
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isSessionValid()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Secure key storage helpers
const SECURE_KEYS_STORAGE = 'ares_mars_keys_enc_v2';
const LEGACY_KEYS_STORAGE = 'ares_mars_keys';

export default function App() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(INITIAL_KEYS);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [metrics, setMetrics] = useState<GatewayMetrics>(INITIAL_METRICS);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>(INITIAL_REQUEST_LOGS);
  const [isStreaming, setIsStreaming] = useState(true);
  const [audioActive, setAudioActive] = useState(false);

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isKeyVaultOpen, setIsKeyVaultOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [playgroundKey, setPlaygroundKey] = useState<ApiKeyRecord | null>(null);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);

  // Load keys securely on mount (encrypted storage migration)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try encrypted storage first
        const enc = await secureGetItem(SECURE_KEYS_STORAGE);
        if (enc && !cancelled) {
          try {
            const parsed = JSON.parse(enc);
            if (Array.isArray(parsed) && parsed.length >= 0) {
              setKeys(parsed);
              setKeysLoaded(true);
              return;
            }
          } catch {}
        }
        // Fallback legacy plain storage (migrate)
        const legacy = localStorage.getItem(LEGACY_KEYS_STORAGE);
        if (legacy && !cancelled) {
          try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed)) {
              setKeys(parsed);
              // migrate to encrypted
              await secureSetItem(SECURE_KEYS_STORAGE, JSON.stringify(parsed));
              try { localStorage.removeItem(LEGACY_KEYS_STORAGE); } catch {}
            }
          } catch {}
        }
      } catch {}
      if (!cancelled) setKeysLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist keys securely
  useEffect(() => {
    if (!keysLoaded) return;
    (async () => {
      try {
        await secureSetItem(SECURE_KEYS_STORAGE, JSON.stringify(keys));
      } catch {}
    })();
  }, [keys, keysLoaded]);

  // Session activity tracking + auto logout
  useEffect(() => {
    setupActivityTracking(() => {
      // auto expire handler
      auditLog('session_expired', 'inactivity timeout');
    });
    const id = setInterval(() => {
      if (!isSessionValid() && window.location.pathname !== '/login' && window.location.pathname !== '/') {
        // If session expired while on protected page, force redirect
        // Use location replace to avoid React router stale state
        if (window.location.pathname === '/dashboard') {
          window.location.href = '/login';
        }
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Real-time metrics streaming engine (1.5s)
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

  // Hardened key generator
  const handleGenerateKey = useCallback(
    (tier: ModelTier, relayZone: RelayZone, customName?: string): ApiKeyRecord => {
      // Validation
      if (!isValidTier(tier)) tier = 'gemini-2.5-flash';
      if (!isValidRelay(relayZone)) relayZone = 'olympus-primary';
      const safeName = sanitizeInput(customName || `Martian Unit (${tier.split('-')[0]})`, SECURITY_CONFIG.MAX_NAME_LENGTH) || `Martian Unit (${tier.split('-')[0]})`;

      // Rate limit
      const check = canGenerateKey();
      if (!check.allowed) {
        auditLog('keygen_rate_limited', check.reason || 'blocked');
        throw new Error(check.reason || 'Rate limited');
      }

      // Require valid session for generation (if not on public demo, allow but log)
      if (!isSessionValid()) {
        // For demo allow, but audit
        auditLog('keygen_no_session', `tier=${tier} zone=${relayZone}`);
      }

      const config = MODEL_TIER_CONFIG[tier];
      const { id: newId, secret: newKeySecret } = generateSecureApiKey();

      const record: ApiKeyRecord = {
        id: newId,
        name: safeName,
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
      recordKeyGeneration();
      auditLog('key_generated', `${newId} tier=${tier}`);
      return record;
    },
    []
  );

  const handleRevokeKey = useCallback((keyId: string): boolean => {
    const cleanId = sanitizeInput(keyId, 128);
    if (!cleanId) return false;
    let found = false;
    setKeys((prev) =>
      prev.map((k) => {
        if (k.id === cleanId || k.key === cleanId || k.key.includes(cleanId)) {
          found = true;
          return { ...k, status: 'revoked' as const };
        }
        return k;
      })
    );
    if (found) auditLog('key_revoked', cleanId.slice(0,32));
    return found;
  }, []);

  const handleToggleAudio = () => {
    const nextState = !audioActive;
    const ok = toggleCosmicDrone(nextState);
    setAudioActive(ok);
  };

  const handleOpenPlayground = (k: ApiKeyRecord) => {
    if (!k || k.status === 'revoked') return;
    setPlaygroundKey(k);
    setIsPlaygroundOpen(true);
  };

  const handleLogout = useCallback(() => {
    clearSession();
    auditLog('logout', 'user logout');
    window.location.href = '/login';
  }, []);

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
            setIsTelemetryOpen={() => { /* no-op */ }}
            metrics={metrics}
            onLogout={handleLogout}
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
            <ProtectedRoute>
              <DashboardPage 
                metrics={metrics}
                requestLogs={requestLogs}
                isStreaming={isStreaming}
                setIsStreaming={setIsStreaming}
                keys={keys}
                handleOpenPlayground={handleOpenPlayground}
                setIsTerminalOpen={setIsTerminalOpen}
              />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/governance" element={
            <ProtectedRoute>
              <AIGovernance />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

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
