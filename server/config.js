// config.js - Centralized secure config (env validation, fail-closed in production)
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name, fallback = null) {
  const v = process.env[name] || fallback;
  if (!v && process.env.NODE_ENV === 'production') {
    console.error(`[FATAL] ${name} required in production`);
    process.exit(1);
  }
  return v;
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Fail-closed in production, ephemeral dev-only otherwise (with warning)
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error('[FATAL] JWT_SECRET required in production');
    process.exit(1);
  }
  jwtSecret = randomHex(64);
  console.warn('[SECURITY] JWT_SECRET ephemeral (dev only) - set JWT_SECRET in production');
}

let tierHmac = process.env.TIER_HMAC;
if (!tierHmac) {
  if (isProd) {
    console.error('[FATAL] TIER_HMAC required in production');
    process.exit(1);
  }
  tierHmac = 'dev-only-tier-hmac-' + randomHex(16);
  console.warn('[SECURITY] TIER_HMAC ephemeral (dev only)');
}

let masterKey = process.env.MASTER_KEY;
if (!masterKey) {
  if (isProd) {
    console.error('[FATAL] MASTER_KEY required in production');
    process.exit(1);
  }
  masterKey = randomHex(32);
  console.warn('[SECURITY] MASTER_KEY ephemeral (dev only)');
}

function parseCodeHashes() {
  // Comma-separated SHA-256 hex allowlist. No defaults — fail-closed.
  const raw = process.env.AUTH_CODE_HASHES || '';
  const set = new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(s => /^[a-f0-9]{64}$/.test(s))
  );
  if (set.size === 0 && isProd) {
    console.error('[FATAL] AUTH_CODE_HASHES required in production (comma-separated SHA-256 hex)');
    process.exit(1);
  }
  if (set.size === 0) console.warn('[SECURITY] AUTH_CODE_HASHES empty — all code logins will fail (fail-closed)');
  return set;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  isProd,
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || '30m',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowOrigins: [process.env.APP_URL, 'http://localhost:3000', 'http://localhost:5173'].filter(Boolean),
  tierHmac,
  masterKey,
  jwtIssuer: process.env.JWT_ISSUER || 'mars-gateway',
  jwtAudience: process.env.JWT_AUDIENCE || 'mars-clients',
  // SSRF allowlist for server-side fetches (OAuth + future LLM upstream).
  // Any fetch to other hosts must be rejected via assertUpstream().
  allowedUpstreams: new Set(
    (process.env.ALLOWED_UPSTREAMS || 'github.com,api.github.com,accounts.google.com,oauth2.googleapis.com,www.googleapis.com,generativelanguage.googleapis.com')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  ),
  authCodeHashes: parseCodeHashes(),
  honeyTokens: new Set(
    (process.env.HONEY_TOKENS || '').split(',').map(s => s.trim()).filter(Boolean)
  ),
  adminSubjects: new Set(
    (process.env.ADMIN_SUBJECTS || '').split(',').map(s => s.trim()).filter(Boolean)
  ),
};
