// tier1Perimeter.js - TIER-1 PERIMETER SHIELD (Edge / WAF)
// Blocks BEFORE reaching core: DDoS, bot, geo, WAF signatures, CAPTCHA
// 2-tier design: Tier1 = Perimeter, Tier2 = Core Vault
import crypto from 'crypto';
import { config } from '../config.js';

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

export function tier1Perimeter(req,res,next){
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

  // 4. CAPTCHA hook (Turnstile/mock): header x-captcha-token required for sensitive POST after 5 failures
  // In prod, verify via Cloudflare: POST https://challenges.cloudflare.com/turnstile/v0/siteverify
  if(req.path.includes('/auth/login') && rec.count>5){
    const cap=req.headers['x-captcha-token'];
    if(!cap) return res.status(403).json({ error:'Tier1: CAPTCHA required', tier:1, needCaptcha:true });
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
  // Single timestamp shared between payload and header so Tier2 can recompute.
  const secret = config.tierHmac;
  const ts = String(Date.now());
  const payload = `${req.method}:${req.path}:${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  req.headers['x-tier1-sig'] = sig;
  req.headers['x-tier1-ts'] = ts;
  // Internal attestation for Tier3 (not trusted from client — overwritten here)
  req.headers['x-tier2-sig'] = crypto.createHmac('sha256', secret).update(`tier2:${payload}:${sig}`).digest('hex');
  next();
}
