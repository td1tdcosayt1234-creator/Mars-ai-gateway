// rateLimiter.js - Hardened rate limiting (memory store)
// Prevents brute-force, DoS, key-generation abuse
import rateLimit from 'express-rate-limit';

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
  keyGenerator: (req) => req.ip,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts. Try in 15 minutes.' })
});

export const keyGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Key generation rate limited (10/min)' }
});

// In-memory brute-force tracker (supplements rateLimit)
const attempts = new Map();
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
  if (success) { attempts.delete(ip); return; }
  rec.count += 1;
  if (rec.count >= 5) rec.blockedUntil = now + 15 * 60 * 1000;
  attempts.set(ip, rec);
}
