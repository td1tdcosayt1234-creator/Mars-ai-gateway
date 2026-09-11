// routes/auth.js - Secure auth endpoints
import express from 'express';
import { body, validationResult } from 'express-validator';
import { verifyCode, signToken } from '../middleware/auth.js';
import { loginLimiter, checkBrute, recordBrute } from '../middleware/rateLimiter.js';
import { config } from '../config.js';
import crypto from 'crypto';

const router = express.Router();

function getIp(req) {
  // Never trust X-Forwarded-For directly — use req.ip (trust proxy=1)
  return req.ip || 'unknown';
}
function sanitize(s, max = 64) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

router.post('/login', loginLimiter, body('code').isString().trim().isLength({ min: 4, max: 64 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
  const ip = getIp(req);
  const chk = checkBrute(ip);
  if (chk.blocked) return res.status(423).json({ error: `Locked. Try in ${Math.ceil(chk.ms / 1000)}s` });

  const code = sanitize(req.body.code, 64);
  const start = Date.now();
  const ok = verifyCode(code);
  const elapsed = Date.now() - start;
  const minDelay = 400 + crypto.randomInt(0, 300);
  if (elapsed < minDelay) await new Promise(r => setTimeout(r, minDelay - elapsed));

  if (!ok) {
    recordBrute(ip, false);
    return res.status(401).json({ error: 'Invalid authorization cipher', attemptsLeft: 5 });
  }
  recordBrute(ip, true);
  const token = signToken({ ip, ua: req.headers['user-agent']?.slice(0, 80) });
  const csrf = crypto.randomBytes(32).toString('hex');
  const isProd = config.isProd;
  res.cookie('ares_token', token, { httpOnly: true, secure: isProd, sameSite: 'strict', maxAge: 30 * 60 * 1000, path: '/' });
  res.cookie('csrf_token', csrf, { httpOnly: false, secure: isProd, sameSite: 'strict', path: '/' });
  // Token returned for non-browser API clients; browser SPA must rely on
  // httpOnly cookie and must NOT persist this in localStorage (XSS).
  res.json({ token, csrf, expiresIn: 1800 });
});

router.post('/logout', (req, res) => {
  res.clearCookie('ares_token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  res.json({ ok: true });
});

router.get('/verify', (req, res) => {
  // This route is protected via global authenticate, but keep simple
  res.json({ valid: true });
});

export default router;
