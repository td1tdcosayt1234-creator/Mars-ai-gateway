// twoFactor.js - 2FA setup/verify for Tier2 vault (TOTP)
// Secrets persisted to data/twoFactor.json (0600, disk-encrypted on Render).
// Multi-instance must use Redis/DB — see redisClient.js. File is 0600 + never logged.
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateSecret, verifyTOTP, otpauthURL } from '../utils/totp.js';
import { mark2FAVerified } from '../middleware/tier2Core.js';
import { loadJson, saveJson } from '../utils/durable.js';

const router=express.Router();
const store=new Map(); // userId -> secret
try {
  const saved = loadJson('twoFactor.json', []);
  for (const [k, v] of saved) {
    if (typeof k === 'string' && typeof v === 'string' && /^[A-Z2-7]+$/.test(v)) store.set(k, v);
  }
} catch {}
function persist2FA() {
  try { saveJson('twoFactor.json', [...store.entries()]); } catch {}
}

router.post('/setup', authenticate, (req,res)=>{
  const uid=req.user.sub || req.user.jti;
  let sec=store.get(uid);
  if(!sec){ sec=generateSecret(); store.set(uid, sec); persist2FA(); }
  const url=otpauthURL(sec, req.user.email||uid, 'MarsAI');
  // In prod, return QR code data URL; here return secret+url
  res.json({ secret: sec, otpauth_url: url, msg:'Add to Authenticator (Google/Microsoft Authenticator)' });
});

router.post('/verify', authenticate, (req,res)=>{
  const { token }=req.body;
  const uid=req.user.sub || req.user.jti;
  const sec=store.get(uid);
  if(!sec) return res.status(400).json({ error:'No 2FA setup, POST /setup first' });
  if(!verifyTOTP(sec, token)) return res.status(401).json({ error:'Invalid TOTP' });
  mark2FAVerified(uid);
  res.json({ ok:true, msg:'2FA verified for 10m (Tier2 vault)' });
});

router.get('/status', authenticate, (req,res)=>{
  const uid=req.user.sub || req.user.jti;
  const sec=store.get(uid);
  res.json({ has2FA: !!sec });
});

export default router;
