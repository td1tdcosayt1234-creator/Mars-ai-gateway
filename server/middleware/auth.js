// auth.js - JWT authentication with httpOnly cookies + Bearer fallback
// Constant-time compare for hashes, secure cookie flags
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30m';

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

// For code verification (SHA256 allowlist)
const ALLOWED = new Set([
  'c55d6cf023bb7f3eee1a914029c7548676b3adc5af011863dff9361eb7d671b1',
  '8a84b6bc02483045e9947bb3ceb71a48b0c4c4133f8e53fb62ea0ddd01b8d699',
  '3669aad75fda7c09de25f86650c33699cee368820c0fc8ef350711e6aff48cec',
]);
export function verifyCode(code) {
  if (!code || code.length < 4 || code.length > 64) return false;
  const h = crypto.createHash('sha256').update(code.toUpperCase().trim()).digest('hex');
  for (const a of ALLOWED) {
    if (crypto.timingSafeEqual(Buffer.from(h), Buffer.from(a))) return true;
  }
  return false;
}
