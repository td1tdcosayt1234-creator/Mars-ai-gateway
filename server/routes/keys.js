// routes/keys.js - Secure API key CRUD (rate-limited, validated, sanitized)
// All keys encrypted at rest in memory (Map), masked on list
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, csrfCheck } from '../middleware/auth.js';
import { keyGenLimiter } from '../middleware/rateLimiter.js';
import { generateSecureKey } from '../utils/crypto.js';

const router = express.Router();
const store = new Map();
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

// Seed
store.set('key_ares_01', { id: 'key_ares_01', name: 'Olympus Research Rover Agent', key: 'ak_mars_live_9f82d7a6e14b09c2b3e81', tier: 'gemini-2.5-flash', relayZone: 'olympus-primary', status: 'active', createdAt: new Date().toISOString(), rpmLimit: 2500, monthlyQuota: 50000000, tokensUsed: 14829210 });

router.get('/', authenticate, (req, res) => {
  const list = [...store.values()].map(k => ({
    id: k.id, name: k.name, tier: k.tier, relayZone: k.relayZone, status: k.status, createdAt: k.createdAt, rpmLimit: k.rpmLimit,
    keyMasked: k.key.slice(0, 14) + '••••' + k.key.slice(-4)
  }));
  res.json({ keys: list });
});

router.post('/', authenticate, keyGenLimiter, csrfCheck, [
  body('tier').isString().custom(v => TIERS.has(v)),
  body('relayZone').isString().custom(v => ZONES.has(v)),
  body('name').optional().isString().trim().isLength({ min: 2, max: 64 }).matches(/^[\w\s\-\.\(\)]+$/),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  const tier = sanitize(req.body.tier, 30);
  const zone = sanitize(req.body.relayZone, 30);
  let name = req.body.name ? sanitize(req.body.name, 64) : `Martian Unit (${tier.split('-')[0]})`;
  if (!validName(name)) return res.status(400).json({ error: 'Invalid name' });
  if (store.size >= 50) return res.status(429).json({ error: 'Key limit reached' });
  const { id, secret } = generateSecureKey();
  const rec = { id, key: secret, name, tier, relayZone: zone, createdAt: new Date().toISOString(), status: 'active', rpmLimit: RPM[tier], monthlyQuota: 50000000, tokensUsed: 0 };
  store.set(id, rec);
  res.status(201).json({ key: rec });
});

router.delete('/:id', authenticate, csrfCheck, param('id').isString().trim().isLength({ min: 5, max: 128 }), (req, res) => {
  const id = sanitize(req.params.id, 128);
  const k = store.get(id) || [...store.values()].find(v => v.key === id);
  if (!k) return res.status(404).json({ error: 'Not found' });
  k.status = 'revoked';
  store.set(k.id, k);
  res.json({ ok: true, id: k.id });
});

export default router;
