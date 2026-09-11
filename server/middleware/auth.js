// auth.js - JWT authentication with httpOnly cookies + Bearer fallback
// Constant-time compare for hashes, secure cookie flags, fail-closed secrets
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES = config.jwtExpires;

export function signToken(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const tokenFromHeader = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const tokenFromCookie = req.cookies?.ares_token || null;
  const token = tokenFromHeader || tokenFromCookie;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function csrfCheck(req, res, next) {
  // If using Bearer, skip CSRF (not cookie-based)
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  const header = req.headers['x-csrf-token'];
  const cookie = req.cookies?.csrf_token;
  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
}

// For code verification (SHA256 allowlist from env, fail-closed — no defaults)
export function verifyCode(code) {
  if (!code || code.length < 4 || code.length > 64) return false;
  if (config.authCodeHashes.size === 0) return false;
  const h = crypto.createHash('sha256').update(code.toUpperCase().trim()).digest('hex');
  for (const a of config.authCodeHashes) {
    if (a.length !== h.length) continue;
    if (crypto.timingSafeEqual(Buffer.from(h), Buffer.from(a))) return true;
  }
  return false;
}
