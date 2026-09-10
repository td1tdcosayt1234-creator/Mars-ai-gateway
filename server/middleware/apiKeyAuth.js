// apiKeyAuth.js - HMAC-signed API key authentication for service-to-service
// Client signs request with secret: HMAC_SHA256(secret, method+path+timestamp+bodyHash)
import crypto from 'crypto';
import { secureStore } from '../utils/secureStore.js';

export function verifyApiKey(req,res,next){
  const keyId = req.headers['x-api-key'];
  const sig = req.headers['x-signature'];
  const ts = req.headers['x-timestamp'];
  if(!keyId || !sig || !ts) return res.status(401).json({ error:'Missing API key signature' });
  const rec = secureStore.get(keyId);
  if(!rec || rec.status!=='active') return res.status(401).json({ error:'Invalid API key' });
  // timestamp 5min window
  const now = Date.now();
  const t = parseInt(ts,10);
  if(isNaN(t) || Math.abs(now - t) > 5*60*1000) return res.status(401).json({ error:'Stale timestamp' });
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body||'')).digest('hex');
  const payload = `${req.method}:${req.path}:${ts}:${bodyHash}`;
  const expect = crypto.createHmac('sha256', rec.key).update(payload).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) {
    return res.status(401).json({ error:'Bad signature' });
  }
  req.apikey = rec;
  next();
}
