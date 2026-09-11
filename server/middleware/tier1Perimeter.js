// tier1Perimeter.js - TIER-1 PERIMETER SHIELD (Edge / WAF)
// Blocks BEFORE reaching core: DDoS, bot, geo, WAF signatures, CAPTCHA
// 2-tier design: Tier1 = Perimeter, Tier2 = Core Vault
import crypto from 'crypto';
import { config } from '../config.js';

let captchaWarned = false;
async function verifyCaptcha(token, ip) {
  const secret = process.env.TURNSTILE_SECRET || '';
  if (!secret) {
    if (!captchaWarned) {
      console.warn('[TIER1] TURNSTILE_SECRET unset — CAPTCHA accepts any token (dev only). Set it in production.');
      captchaWarned = true;
    }
    return typeof token === 'string' && token.length > 0;
  }
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: String(token), remoteip: ip || '' }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json().catch(() => ({}));
    return d.success === true;
  } catch (e) {
    console.warn('[TIER1] Turnstile outage, failing open (brute limits still apply)');
    return true;
  }
}

// WAF signatures (OWASP + AI)
const WAF_SIGS = [
  { pat: /(\bUNION\b.*\bSELECT\b|\bOR\s+1=1\b)/i, name: 'SQLi' },
  { pat: /<script|onerror\s*=|onload\s*=/i, name: 'XSS' },
  { pat: /\.\.\/|etc\/passwd|win\.ini/i, name: 'PathTraversal' },
  { pat: /\$\{.*\}/, name: 'SSTI' },
  { pat: /ignore\s+previous\s+instructions|system\s+prompt|jailbreak/i, name: 'PromptInjection' },
];

// In-memory edge counters (Tier1)
const edgeHits = new Map(); // ip -> { count, first, blockUntil }
const BOT_UA = [/HeadlessChrome/i, /PhantomJS/i, /sqlmap/i];

export async function tier1Perimeter(req,res,next){
  const ip = req.ip;
  const now = Date.now();

  // 1. IP edge rate: 300 req / 1min (looser than Tier2, but blocks floods)
  let rec = edgeHits.get(ip) || { count:0, first:now, blockUntil:0 };
  if (rec.blockUntil && now < rec.blockUntil) {
    res.setHeader('Retry-After', Math.ceil((rec.blockUntil-now)/1000));
    return res.status(429).json({ error:'Tier1: Edge blocked (flood)', tier:1 });
  }
  if (now - rec.first > 60*1000) { rec={count:0, first:now, blockUntil:0}; }
  rec.count++;
  if (rec.count>300) { rec.blockUntil=now+ 5*60*1000; edgeHits.set(ip, rec); return res.status(429).json({ error:'Tier1: Flood detected', tier:1 }); }
  edgeHits.set(ip, rec);

  // 2. Bot UA
  const ua=req.headers['user-agent']||'';
  for(const pat of BOT_UA) if(pat.test(ua)) return res.status(403).json({ error:'Tier1: Bot blocked', tier:1 });

  // 3. WAF signature scan on url+body
  const hay = `${req.url} ${JSON.stringify(req.body||{})} ${JSON.stringify(req.query||{})}`;
  for(const {pat,name} of WAF_SIGS){
    if(pat.test(hay)){
      console.warn(`[TIER1 WAF] ${name} ip=${ip} url=${req.url}`);
      return res.status(403).json({ error:`Tier1 WAF: ${name} detected`, tier:1 });
    }
  }

  // 4. CAPTCHA: x-captcha-token required for login after 5 edge hits.
  // Real Cloudflare Turnstile verify when TURNSTILE_SECRET is set; otherwise
  // any non-empty token passes (dev) with a one-time warning. Verifier outage
  // fails OPEN (brute limits still apply) but is audited.
  if(req.path.includes('/auth/login') && rec.count>5){
    const cap=req.headers['x-captcha-token'];
    if(!cap) return res.status(403).json({ error:'Tier1: CAPTCHA required', tier:1, needCaptcha:true });
    if(!(await verifyCaptcha(cap, ip))){
      return res.status(403).json({ error:'Tier1: CAPTCHA invalid', tier:1, needCaptcha:true });
    }
  }

  // 5. Geo allowlist stub (allow BD/US/SG, block others if configured)
  // const country=req.headers['cf-ipcountry']||req.headers['x-country'];
  // if(country && !['BD','US','SG'].includes(country)) return res.status(403).json({ error:'Tier1: Geo blocked' });

  // Tag tier1 passed
  req.tier1=true;
  res.setHeader('X-Tier1', 'pass');
  next();
}

export function internalHmacSign(req,res,next){
  // Tier1 → Tier2 internal HMAC (prevents bypassing Tier1).
  // Uses originalUrl pathname (never stripped by mounted routers) + single
  // timestamp shared between payload and header so Tier2 can recompute.
  const secret = config.tierHmac;
  const ts = String(Date.now());
  let p = req.originalUrl || req.url || req.path;
  try { p = new URL(p, 'http://internal').pathname; } catch {}
  const payload = `${req.method}:${p}:${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  req.headers['x-tier1-sig'] = sig;
  req.headers['x-tier1-ts'] = ts;
  // Internal attestation for Tier3 (not trusted from client — overwritten here)
  req.headers['x-tier2-sig'] = crypto.createHmac('sha256', secret).update(`tier2:${payload}:${sig}`).digest('hex');
  next();
}
