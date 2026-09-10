// security.js - Hardened security headers & sanitization middleware
// Keeps previous frontend CSP, adds backend defense
import helmet from 'helmet';

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.github.com", "https://generativelanguage.googleapis.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// Extra headers not covered by helmet
export function extraSecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Remove powered-by
  res.removeHeader('X-Powered-By');
  next();
}

// Input sanitization helper
export function sanitizeInput(str, max = 1000) {
  if (typeof str !== 'string') return '';
  let s = str.trim().slice(0, max);
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '');
  s = s.replace(/<script/gi, '').replace(/onerror=/gi, '');
  return s;
}

export function validateName(name) {
  const s = sanitizeInput(name, 64);
  return s.length >= 2 && s.length <= 64 && /^[\w\s\-\.\(\)]+$/.test(s);
}
