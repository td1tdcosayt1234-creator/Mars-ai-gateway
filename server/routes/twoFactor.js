// twoFactor.js - 2FA setup/verify for Tier2 vault (TOTP)
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateSecret, verifyTOTP, otpauthURL } from '../utils/totp.js';
import { mark2FAVerified } from '../middleware/tier2Core.js';

const router=express.Router();
const store=new Map(); // userId -> secret

router.post('/setup', authenticate, (req,res)=>{
  const uid=req.user.sub || req.user.jti;
  let sec=store.get(uid);
  if(!sec){ sec=generateSecret(); store.set(uid, sec); }
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
