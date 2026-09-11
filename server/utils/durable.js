// durable.js - crash-safe file-backed JSON store (single-instance persistence)
// Multi-instance production must set REDIS_URL (see redisClient.js) — this file
// ensures single-instance Render free tier survives restarts. Atomic write via
// tmp+rename. Data dir is gitignored. Never stores plaintext secrets — callers
// must encrypt before persist (secureStore does AES-GCM).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
