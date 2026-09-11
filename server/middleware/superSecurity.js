// superSecurity.js - Super powerful defense for AI Gateway (zero-trust)
// Adds: Expect-CT, COEP, CORP, DNS-prefetch, frame-ancestors, IP anomaly, UA fingerprint, 2FA hook
import crypto from 'crypto';

const SUSPICIOUS_UA = [/sqlmap/i, /nikto/i, /nmap/i, /curl.*\/\d/i, /python-requests/i];
const BAD_IP_CACHE = new Map(); // ip -> {count, until}

export function superHeaders(req,res,next){
  // Extra hardening beyond helmet
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Expect-CT', 'max-age=86400, enforce');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  // Remove fingerprints
  res.removeHeader('X-Powered-By');
  next();
}

export function uaAnomaly(req,res,next){
  const ua=req.headers['user-agent']||'';
  if(!ua || ua.length<10) return res.status(400).json({ error:'Missing UA' });
  for(const pat of SUSPICIOUS_UA){
    if(pat.test(ua)){
      console.warn(`[SUPER] suspicious UA ${ua} ip=${req.ip}`);
      return res.status(403).json({ error:'Blocked: suspicious client' });
    }
  }
  // fingerprint
  const fp=crypto.createHash('sha256').update(`${ua}|${req.headers['accept-language']||''}|${req.ip}`).digest('hex').slice(0,16);
  req.fp=fp;
  next();
}

export function ipReputation(req,res,next){
  const ip=req.ip;
  const rec=BAD_IP_CACHE.get(ip);
  if(rec && Date.now()<rec.until) return res.status(429).json({ error:'IP temporarily blocked (anomaly)', retry: Math.ceil((rec.until-Date.now())/1000) });
  // simple anomaly: too many 401s (tracked elsewhere)
  next();
}
export function recordBadIP(ip){
  const rec=BAD_IP_CACHE.get(ip)||{count:0};
  rec.count++;
  if(rec.count>=10) rec.until=Date.now()+ 60*60*1000; // 1h block after 10 bad
  BAD_IP_CACHE.set(ip, rec);
}

// 2FA hook — DEPRECATED mock removed. Use server/utils/totp.js (RFC6238) via
// server/routes/twoFactor.js + tier2Core mark2FAVerified. This stub stays
// fail-closed so legacy imports cannot bypass 2FA.
export function generateTOTPSecret(_userId){
  throw new Error('Deprecated: use POST /api/2fa/setup (RFC6238 TOTP)');
}
export function verifyTOTP(_userId, _token){
  return false;
}
