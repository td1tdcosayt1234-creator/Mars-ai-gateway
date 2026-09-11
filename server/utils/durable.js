// durable.js - crash-safe file-backed store (single-instance persistence)
// Multi-instance production must set REDIS_URL (see redisClient.js) — this file
// ensures single-instance Render free tier survives restarts. Atomic write via
// tmp+rename, files 0600, data/ gitignored.
//
// Hacker-proofing: sensitive files are AES-256-GCM sealed (saveSecure/loadSecure)
// with a PBKDF2(210k) key from MASTER_KEY — stolen disk files reveal nothing and
// any tampering fails authentication (GCM tag) instead of loading silently.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

export function loadJson(name, fallback) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[DURABLE] load ${name} failed, using fallback`);
    return fallback;
  }
}

export function saveJson(name, obj) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  const tmp = p + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
    fs.renameSync(tmp, p);
    try { fs.chmodSync(p, 0o600); } catch {}
  } catch (e) {
    console.warn(`[DURABLE] save ${name} failed:`, e.message);
  }
}

function sealKey() {
  return crypto.pbkdf2Sync(config.masterKey, 'mars-durable-v1', 210000, 32, 'sha256');
}

// Sealed envelope: base64(iv12 + tag16 + ciphertext). Tamper = decrypt throws.
export function saveSecure(name, obj) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  const tmp = p + '.tmp.' + process.pid;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, tag, enc]).toString('base64');
    fs.writeFileSync(tmp, JSON.stringify({ sealed: true, v: 1, blob }), { mode: 0o600 });
    fs.renameSync(tmp, p);
    try { fs.chmodSync(p, 0o600); } catch {}
  } catch (e) {
    console.warn(`[DURABLE] sealed save ${name} failed:`, e.message);
  }
}

export function loadSecure(name, fallback) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw || raw.sealed !== true || typeof raw.blob !== 'string') {
      throw new Error('not sealed');
    }
    const buf = Buffer.from(raw.blob, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch (e) {
    console.warn(`[DURABLE] sealed load ${name} failed (tamper/wrong key?), using fallback`);
    return fallback;
  }
}

// One-time migration: sealed first, legacy plaintext second (then re-seal).
export function loadSecureWithLegacy(name, fallback) {
  const v = loadSecure(name, undefined);
  if (v !== undefined) return v;
  const legacy = loadJson(name, undefined);
  if (legacy !== undefined) {
    console.log(`[DURABLE] migrating ${name} to sealed format`);
    saveSecure(name, legacy);
    return legacy;
  }
  return fallback;
}
