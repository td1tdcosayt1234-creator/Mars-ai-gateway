// twoFactor.js - 2FA setup/verify for Tier2 vault (TOTP)
// Secrets persisted to data/twoFactor.json (0600, disk-encrypted on Render).
// Multi-instance must use Redis/DB — see redisClient.js. File is 0600 + never logged.
import express from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { generateSecret, verifyTOTP, otpauthURL } from '../utils/totp.js';
import { mark2FAVerified } from '../middleware/tier2Core.js';
import { tfaLimiter } from '../middleware/rateLimiter.js';
import { loadSecureWithLegacy, saveSecure } from '../utils/durable.js';

const router=express.Router();
const store=new Map(); // userId -> secret (TOTP seeds: sealed at rest, 0600)
const codes=new Map(); // userId -> [sha256hex...] one-time backup codes, sealed
try {
  const saved = loadSecureWithLegacy('twoFactor.json', []);
  for (const [k, v] of saved) {
    if (typeof k === 'string' && typeof v === 'string' && /^[A-Z2-7]+$/.test(v)) store.set(k, v);
  }
} catch {}
try {
  const savedCodes = loadSecureWithLegacy('twoFactorCodes.json', []);
  for (const [k, v] of savedCodes) {
    if (typeof k === 'string' && Array.isArray(v)) codes.set(k, v.filter(h => typeof h === 'string'));
  }
} catch {}
function persist2FA() {
  try { saveSecure('twoFactor.json', [...store.entries()]); } catch {}
  try { saveSecure('twoFactorCodes.json', [...codes.entries()]); } catch {}
}

function newBackupCodes() {
  const plain = [];
  const hashed = [];
  for (let i = 0; i < 10; i++) {
    const c = crypto.randomBytes(5).toString('hex').toUpperCase();
    plain.push(`${c.slice(0, 5)}-${c.slice(5)}`);
    hashed.push(crypto.createHash('sha256').update(plain[i]).digest('hex'));
  }
  return { plain, hashed };
}

function consumeBackupCode(uid, code) {
  if (typeof code !== 'string') return false;
  const norm = code.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[A-F0-9]{10}$/.test(norm)) return false;
  const list = codes.get(uid) || [];
  const h = crypto.createHash('sha256').update(`${norm.slice(0, 5)}-${norm.slice(5)}`).digest('hex');
  for (const stored of list) {
    if (stored.length !== h.length) continue;
    if (crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(h))) {
      codes.set(uid, list.filter(x => x !== stored));
      persist2FA();
      return true;
    }
  }
  return false;
}

router.post('/setup', authenticate, tfaLimiter, (req,res)=>{
  const uid=req.user.sub || req.user.jti;
  let sec=store.get(uid);
  let backupCodes;
  if(!sec){
    sec=generateSecret(); store.set(uid, sec);
    const bc = newBackupCodes();
    codes.set(uid, bc.hashed);
    backupCodes = bc.plain; // shown ONCE — store offline now
    persist2FA();
  }
  const url=otpauthURL(sec, req.user.email||uid, 'MarsAI');
  // In prod, return QR code data URL; here return secret+url
  res.json({ secret: sec, otpauth_url: url, ...(backupCodes ? { backup_codes: backupCodes } : { backup_codes_left: (codes.get(uid) || []).length }), msg:'Add to Authenticator (Google/Microsoft Authenticator)' });
});

router.post('/verify', authenticate, tfaLimiter, (req,res)=>{
  const { token, backupCode }=req.body || {};
  const uid=req.user.sub || req.user.jti;
  if (typeof backupCode === 'string' && backupCode) {
    if(consumeBackupCode(uid, backupCode)) {
      mark2FAVerified(uid);
      return res.json({ ok:true, msg:'Backup code accepted (consumed). Tier2 vault 10m.' });
    }
    return res.status(401).json({ error:'Invalid backup code' });
  }
  const sec=store.get(uid);
  if(!sec) return res.status(400).json({ error:'No 2FA setup, POST /setup first' });
  if(!verifyTOTP(sec, token)) return res.status(401).json({ error:'Invalid TOTP' });
  mark2FAVerified(uid);
  res.json({ ok:true, msg:'2FA verified for 10m (Tier2 vault)' });
});

router.get('/status', authenticate, (req,res)=>{
  const uid=req.user.sub || req.user.jti;
  const sec=store.get(uid);
  res.json({ has2FA: !!sec, backupCodesLeft: (codes.get(uid) || []).length });
});

export default router;
