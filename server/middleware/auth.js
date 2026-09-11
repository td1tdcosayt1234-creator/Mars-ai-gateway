// auth.js - JWT authentication with httpOnly cookies + Bearer fallback
// 20x: iss/aud binding, UA-fingerprint binding, denylist (logout/refresh),
// Origin/Referer check for cookie auth, no-store helper. Fail-closed secrets.
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { isDenied } from '../utils/denylist.js';
import { audit } from './auditLogger.js';

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES = config.jwtExpires;
const JWT_ISSUER = config.jwtIssuer;
const JWT_AUDIENCE = config.jwtAudience;

export function fingerprint(req) {
  return crypto.createHash('sha256').update(req.headers['user-agent'] || '').digest('hex').slice(0, 16);
}

function fpEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

export function signToken(payload) {
  const jti = crypto.randomUUID();
  // iss/aud live in the payload only (jsonwebtoken rejects them in options too).
  // Explicit HS256 kills algorithm-confusion (none/RS256) outright.
  return jwt.sign(
    { ...payload, jti, iss: JWT_ISSUER, aud: JWT_AUDIENCE },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithms: ['HS256'] });
}

export function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const tokenFromHeader = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const tokenFromCookie = req.cookies?.ares_token || null;
  const token = tokenFromHeader || tokenFromCookie;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  // Logout/refresh revocation (reuse of denylisted jti = incident, audited)
  if (isDenied(payload.jti)) {
    console.warn(`[AUTH] denylisted token reuse jti=${String(payload.jti).slice(0, 8)} ip=${req.ip}`);
    try { audit('token_reuse', `revoked jti ${String(payload.jti).slice(0, 8)} replayed`, req.ip, '-'); } catch {}
    return res.status(401).json({ error: 'Token revoked', revoked: true });
  }
  // UA-fingerprint binding: stolen tokens fail on different clients
  if (payload.fp && !fpEqual(payload.fp, fingerprint(req))) {
    console.warn(`[AUTH] fingerprint mismatch jti=${String(payload.jti).slice(0, 8)} ip=${req.ip}`);
    return res.status(401).json({ error: 'Session bound to another client' });
  }
  // IP change is audited (not blocked — mobile networks roam)
  if (payload.ip && payload.ip !== req.ip) {
    console.log(`[AUTH] ip change jti=${String(payload.jti).slice(0, 8)} from=${payload.ip} to=${req.ip}`);
  }
  req.user = payload;
  next();
}

export function csrfCheck(req, res, next) {
  // If using Bearer, skip CSRF (not cookie-based)
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  // Origin/Referer must match allowlist when present (double-submit + origin check)
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const checkUrl = origin || (referer ? (() => { try { return new URL(referer).origin; } catch { return null; } })() : null);
  if (checkUrl && !config.allowOrigins.includes(checkUrl)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  const header = req.headers['x-csrf-token'];
  const cookie = req.cookies?.csrf_token;
  if (typeof header !== 'string' || typeof cookie !== 'string' || header.length !== cookie.length) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  let ok = false;
  try { ok = crypto.timingSafeEqual(Buffer.from(header), Buffer.from(cookie)); } catch { ok = false; }
  if (!ok) return res.status(403).json({ error: 'CSRF token mismatch' });
  next();
}

// Never cache secrets: auth / keys / 2fa / vault responses
export function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
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
