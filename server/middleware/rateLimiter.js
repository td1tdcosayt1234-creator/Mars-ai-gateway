// rateLimiter.js - Hardened rate limiting (Redis-ready, file-backed brute store)
// Prevents brute-force, DoS, key-generation abuse
// Multi-instance: set REDIS_URL + use rate-limit-redis (see redisClient.js).
// Single-instance: memory + file-backed brute map (data/brute.json) survives restarts.
// Keying uses default req.ip (trust proxy=1) — never X-Forwarded-For directly.
import rateLimit from 'express-rate-limit';
import { loadSecureWithLegacy, saveSecure } from '../utils/durable.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
  handler: (req, res) => {
    console.warn(`[RATE_LIMIT] Global ${req.ip} ${req.path}`);
    res.status(429).json({ error: 'Too many requests' });
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts. Try in 15 minutes.' })
});

export const keyGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Key generation rate limited (10/min)' }
});

// Brute-force tracker (supplements rateLimit), sealed at rest — tampering with
// lockout counters fails GCM auth instead of unlocking attackers.
// For multi-instance, set REDIS_URL and share via Redis (redisClient.getRedis()).
const attempts = new Map();
try {
  const saved = loadSecureWithLegacy('brute.json', []);
  for (const [ip, rec] of saved) {
    if (typeof ip === 'string' && rec && typeof rec.count === 'number') attempts.set(ip, rec);
  }
} catch {}
let persistT = null;
function persistBrute() {
  if (persistT) return;
  persistT = setTimeout(() => {
    persistT = null;
    try { saveSecure('brute.json', [...attempts.entries()].slice(-500)); } catch {}
  }, 2000);
}
export function checkBrute(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, firstTs: now, blockedUntil: 0 };
  if (rec.blockedUntil && now < rec.blockedUntil) return { blocked: true, ms: rec.blockedUntil - now };
  if (now - rec.firstTs > 15 * 60 * 1000) { rec.count = 0; rec.firstTs = now; }
  return { blocked: false, rec };
}
export function recordBrute(ip, success) {
  const now = Date.now();
  let rec = attempts.get(ip);
  if (!rec) rec = { count: 0, firstTs: now, blockedUntil: 0 };
  if (now - rec.firstTs > 15 * 60 * 1000) { rec.count = 0; rec.firstTs = now; rec.blockedUntil = 0; }
  if (success) { attempts.delete(ip); persistBrute(); return; }
  rec.count += 1;
  if (rec.count >= 5) rec.blockedUntil = now + 15 * 60 * 1000;
  attempts.set(ip, rec);
  persistBrute();
}
