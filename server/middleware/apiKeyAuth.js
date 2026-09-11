// apiKeyAuth.js - HMAC-signed API key authentication for service-to-service
// Client signs request with secret: HMAC_SHA256(secret, method+path+timestamp+bodyHash)
import crypto from 'crypto';
import { secureStore } from '../utils/secureStore.js';

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Hex strings must be same length — fail closed without throwing
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function stableBodyHash(body) {
  // Deterministic body hash — sorted keys to avoid key-order mismatch
  const s = body == null ? '' : JSON.stringify(sortKeys(body));
  return crypto.createHash('sha256').update(s).digest('hex');
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

export function verifyApiKey(req,res,next){
  const keyId = req.headers['x-api-key'];
  const sig = req.headers['x-signature'];
  const ts = req.headers['x-timestamp'];
  if(typeof keyId !== 'string' || typeof sig !== 'string' || typeof ts !== 'string') {
    return res.status(401).json({ error:'Missing API key signature' });
  }
  const rec = secureStore.get(keyId);
  if(!rec || rec.status!=='active') return res.status(401).json({ error:'Invalid API key' });
  // timestamp 5min window
  const now = Date.now();
  const t = parseInt(ts,10);
  if(!Number.isFinite(t) || Math.abs(now - t) > 5*60*1000) return res.status(401).json({ error:'Stale timestamp' });
  const bodyHash = stableBodyHash(req.body || '');
  const payload = `${req.method}:${req.path}:${ts}:${bodyHash}`;
  const expect = crypto.createHmac('sha256', rec.key).update(payload).digest('hex');
  if(!safeEqualHex(expect, sig)) {
    return res.status(401).json({ error:'Bad signature' });
  }
  req.apikey = rec;
  next();
}
