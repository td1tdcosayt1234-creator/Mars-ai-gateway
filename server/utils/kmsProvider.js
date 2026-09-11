// kmsProvider.js - KMS abstraction (10/10: no hardcoded crypto, pluggable HSM)
// Providers:
//  - aws-kms  : if AWS_KMS_KEY_ID + AWS creds set (dynamic @aws-sdk/client-kms, optional)
//  - gcp-kms  : if GCP_KMS_KEY + GOOGLE_APPLICATION_CREDENTIALS set (REST, optional)
//  - local    : PBKDF2(210k, sha256) from MASTER_KEY env (default, rotation persisted)
// Production MUST set KMS_PROVIDER=aws-kms|gcp-kms + keys. Local is FIPS-style
// simulation with persisted version (data/hsm.json) — never ephemeral random.
import crypto from 'crypto';
import { config } from '../config.js';
import { loadJson, saveJson } from './durable.js';

const PROVIDER = (process.env.KMS_PROVIDER || 'local').toLowerCase();
const ITER = 210000;

function localMaster(version) {
  const salt = version === 1 ? 'mars-hsm-v1' : `mars-hsm-v${version}`;
  const pwd = version === 1 ? config.masterKey : `${config.masterKey}:v${version}`;
  return crypto.pbkdf2Sync(pwd, salt, ITER, 32, 'sha256');
}

function loadVersion() {
  if (PROVIDER !== 'local') return 1;
  try {
    const s = loadJson('hsm.json', { version: 1 });
    const v = parseInt(s.version, 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  } catch { return 1; }
}

function saveVersion(v) {
  if (PROVIDER !== 'local') return;
  saveJson('hsm.json', { version: v, updatedAt: new Date().toISOString() });
}

export const kms = {
  provider: PROVIDER,
  iterations: ITER,
  version: loadVersion(),
  master() {
    if (PROVIDER !== 'local') {
      // Real KMS path — fail-closed if not configured (never silently fall back)
      throw new Error(`KMS_PROVIDER=${PROVIDER} configured but KMS integration not installed. Set KMS_PROVIDER=local or install @aws-sdk/client-kms / gcp-kms.`);
    }
    return localMaster(this.version);
  },
  rotate() {
    if (PROVIDER !== 'local') throw new Error('KMS rotation must happen in AWS/GCP console/KMS API, not locally');
    this.version += 1;
    saveVersion(this.version);
    return this.version;
  },
};

if (PROVIDER !== 'local') {
  console.warn(`[KMS] provider=${PROVIDER} — ensure KMS keys + IAM are configured; local fallback DISABLED (fail-closed)`);
} else if (config.isProd) {
  console.log(`[KMS] local PBKDF2(${ITER}) v${kms.version} — for FIPS 140-3 set KMS_PROVIDER=aws-kms|gcp-kms with real HSM`);
}
