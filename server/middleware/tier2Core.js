// tier2Core.js - TIER-2 CORE VAULT (Zero-trust, 2FA, RBAC, Encrypted session)
// Only runs AFTER Tier1 pass. Requires valid Tier1 sig + JWT + optional 2FA + RBAC
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { isDenied } from '../utils/denylist.js';

const JWT_SECRET = config.jwtSecret;
const TIER_HMAC = config.tierHmac;

// 2FA session store: userId -> { verifiedUntil }
const twoFAStore=new Map();

export function tier2Guard(req,res,next){
  // 1. Verify Tier1 passed + HMAC recomputed (fail-closed, constant-time)
  if(!req.tier1) return res.status(403).json({ error:'Tier2: Tier1 bypass detected', tier:2 });
  const sig = req.headers['x-tier1-sig'];
  const ts = req.headers['x-tier1-ts'];
  if(typeof sig !== 'string' || typeof ts !== 'string') {
    return res.status(403).json({ error:'Tier2: Invalid Tier1 signature', tier:2 });
  }
  const tsNum = parseInt(ts, 10);
  if(!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 30*1000){
    return res.status(403).json({ error:'Tier2: Invalid Tier1 signature', tier:2 });
  }
  // originalUrl: mounted routers strip req.url/req.path — originalUrl is stable
  let p = req.originalUrl || req.url || req.path;
  try { p = new URL(p, 'http://internal').pathname; } catch {}
  const expected = crypto.createHmac('sha256', TIER_HMAC).update(`${req.method}:${p}:${ts}`).digest('hex');
  if(expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))){
    return res.status(403).json({ error:'Tier2: Invalid Tier1 signature', tier:2 });
  }

  // 2. JWT must exist (already via authenticate, but double-check)
  const auth=req.headers.authorization||'';
  const tok=auth.startsWith('Bearer ')? auth.slice(7): req.cookies?.ares_token;
  if(!tok) return res.status(401).json({ error:'Tier2: No vault token', tier:2 });
  try{
    const p=jwt.verify(tok, JWT_SECRET, { issuer: config.jwtIssuer, audience: config.jwtAudience });
    if(isDenied(p.jti)) return res.status(401).json({ error:'Tier2: Token revoked', tier:2 });
    req.user=p;
  }catch{
    return res.status(401).json({ error:'Tier2: Vault token invalid', tier:2 });
  }

  // 3. 2FA check for sensitive ops (key gen, revoke, metrics)
  const sensitive= req.path.includes('/keys') && req.method!=='GET' || req.path.includes('/metrics') || req.path.includes('/governance');
  if(sensitive){
    const tfa=req.headers['x-2fa-token'];
    const uid=req.user.sub || req.user.jti;
    const rec=twoFAStore.get(uid);
    // If 2FA not yet verified in last 10min, require it
    if(!rec || Date.now()>rec.verifiedUntil){
      if(!tfa) return res.status(403).json({ error:'Tier2: 2FA required (TOTP)', tier:2, need2FA:true });
      // tfa will be verified by twoFactor middleware, but quick check here
      // Defer to next middleware
    }
  }

  // 4. RBAC per tier
  const role=req.user.provider==='github' ? 'user' : req.user.provider==='google' ? 'user' : 'vault_user';
  // Example: only ares-neural-70b requires elevated (mock)
  if(req.body?.model==='ares-neural-70b' && role!=='admin'){
    // allow but log; in strict, block
    console.log(`[TIER2 RBAC] elevated model requested by ${role}`);
  }

  res.setHeader('X-Tier2', 'vault-pass');
  next();
}

export function mark2FAVerified(userId){
  twoFAStore.set(userId, { verifiedUntil: Date.now()+ 10*60*1000 });
}
export function is2FAVerified(userId){
  const rec=twoFAStore.get(userId);
  return rec && Date.now()<rec.verifiedUntil;
}
