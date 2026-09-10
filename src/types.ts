export type ModelTier = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'ares-neural-70b' | 'deep-space-vision';

export type RelayZone = 'olympus-primary' | 'chryse-ground' | 'phobos-orbital' | 'valles-marineris';

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  tier: ModelTier;
  relayZone: RelayZone;
  createdAt: string;
  lastUsedAt?: string;
  status: 'active' | 'revoked' | 'rate-limited';
  tokensUsed: number;
  requestCount: number;
  monthlyQuota: number; // in tokens
  rpmLimit: number;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  keyId: string;
  keyName: string;
  endpoint: string;
  status: 200 | 429 | 500 | 201;
  latencyMs: number;
  tokens: number;
  model: string;
  origin: string; // e.g., 'Perseverance-Hub', 'Colony-Dome-A', 'Earth-Relay-3'
}

export interface GatewayMetrics {
  currentRps: number;
  peakRps: number;
  totalRequestsToday: number;
  totalTokensToday: number;
  activeKeysCount: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number; // percentage, e.g. 0.02
  earthMarsDelayMinutes: number; // e.g. 4.2
  clusterHealth: 'nominal' | 'degraded' | 'calibrating';
  rpsHistory: number[];
  tokenThroughputHistory: number[];
  latencyHistory: number[];
}

export interface TerminalEntry {
  id: string;
  timestamp: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system';
  content: string;
  rawJson?: unknown;
}
