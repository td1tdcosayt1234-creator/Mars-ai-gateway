// routes/keys.js - Secure API key CRUD (rate-limited, validated, sanitized)
// All keys encrypted at rest via secureStore (AES-256-GCM), masked on list
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, csrfCheck } from '../middleware/auth.js';
import { keyGenLimiter } from '../middleware/rateLimiter.js';
import { generateSecureKey } from '../utils/crypto.js';
import { secureStore } from '../utils/secureStore.js';

const router = express.Router();
// Unified encrypted store — single source of truth (server.js also uses secureStore)
const store = secureStore;
const RPM = { 'gemini-2.5-flash': 2500, 'gemini-2.5-pro': 1000, 'ares-neural-70b': 5000, 'deep-space-vision': 800 };
const TIERS = new Set(Object.keys(RPM));
const ZONES = new Set(['olympus-primary', 'chryse-ground', 'phobos-orbital', 'valles-marineris']);

function sanitize(s, max = 64) {
  if (typeof s !== 'string') return '';
  let r = s.trim().slice(0, max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return r.replace(/javascript:/gi, '').replace(/<script/gi, '');
}
function validName(n) {
  const s = sanitize(n, 64);
  return s.length >= 2 && /^[\w\s\-\.\(\)]+$/.test(s);
}

// No demo seeds — keys issued via POST / only.

router.get('/', authenticate, (req, res) => {
  // Owner-scoped (legacy router; authoritative route lives in server.js)
  const owner = req.user.sub || req.user.jti;
  res.json({ keys: store.listMasked(owner, false) });
});

router.post('/', authenticate, keyGenLimiter, csrfCheck, [
  body('tier').isString().custom(v => TIERS.has(v)),
  body('relayZone').isString().custom(v => ZONES.has(v)),
  body('name').optional().isString().trim().isLength({ min: 2, max: 64 }).matches(/^[\w\s\-\.\(\)]+$/),
  body('models').optional().isArray({ max: 4 }),
  body('models.*').optional().isString().custom(v => TIERS.has(v)),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
  body('ipAllowlist').optional().isArray({ max: 10 }),
  body('ipAllowlist.*').optional().isString().trim().isLength({ min: 7, max: 45 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  const tier = sanitize(req.body.tier, 30);
  const zone = sanitize(req.body.relayZone, 30);
  let name = req.body.name ? sanitize(req.body.name, 64) : `Martian Unit (${tier.split('-')[0]})`;
  if (!validName(name)) return res.status(400).json({ error: 'Invalid name' });
  if (store.size() >= 50) return res.status(429).json({ error: 'Key limit reached' });
  if (store.ownerCount(req.user.sub || req.user.jti) >= 20) return res.status(429).json({ error: 'Key limit reached (20 per account)' });
  // Least-privilege defaults: chat-only, single model, 90d expiry, no IP pin unless set
  const models = Array.isArray(req.body.models) && req.body.models.length
    ? [...new Set(req.body.models.map(m => sanitize(m, 30)).filter(m => TIERS.has(m)))]
    : [tier];
  if (!models.includes(tier)) models.push(tier);
  const days = req.body.expiresInDays ? parseInt(req.body.expiresInDays, 10) : 90;
  const expiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
  const ipAllowlist = Array.isArray(req.body.ipAllowlist)
    ? req.body.ipAllowlist.map(ip => sanitize(ip, 45)).filter(ip => /^[0-9a-fA-F:.]{7,45}$/.test(ip)).slice(0,10)
    : [];
  const { id, secret } = generateSecureKey();
  const rec = { id, key: secret, name, tier, relayZone: zone, createdAt: new Date().toISOString(), status: 'active', rpmLimit: RPM[tier], monthlyQuota: 50000000, tokensUsed: 0, models, scopes: ['chat:write','tokenize:write'], ipAllowlist, expiresAt, owner: req.user.sub || req.user.jti };
  store.set(id, rec);
  // Return plaintext once at creation only — never again (list is masked)
  res.status(201).json({ key: rec });
});

router.delete('/:id', authenticate, csrfCheck, param('id').isString().trim().isLength({ min: 5, max: 128 }), (req, res) => {
  const id = sanitize(req.params.id, 128);
  // Lookup by id only + ownership (others' ids answer 404 — no oracle)
  const k = store.get(id);
  const owner = req.user.sub || req.user.jti;
  if (!k || !store.owns(id, owner, false)) return res.status(404).json({ error: 'Not found' });
  store.revoke(k.id);
  res.json({ ok: true, id: k.id });
});

export default router;
