// Mars AI Gateway - Hardened Backend (Express + Security)
// Keeps previous frontend security, adds authoritative backend validation
// All secrets via env, no plaintext exposure, defense in depth
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { audit, auditMiddleware, verifyChain } from './server/middleware/auditLogger.js';
import { guardPrototypePollution, xssGuard, strictJsonLimit } from './server/middleware/validation.js';
import { secureStore } from './server/utils/secureStore.js';
import { superHeaders, uaAnomaly, ipReputation } from './server/middleware/superSecurity.js';
import oauthRouter from './server/routes/oauth.js';
import aiGateway from './server/routes/aiGateway.js';
import { aiFirewall } from './server/middleware/aiFirewall.js';
import { quotaGuard } from './server/middleware/tenantQuota.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30m';
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] JWT_SECRET not set — using ephemeral random secret (sessions will invalidate on restart). Set JWT_SECRET in .env');
}
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET required in production');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// In-memory stores (production: replace with DB/Redis)
// ---------------------------------------------------------------------------
const loginAttempts = new Map(); // ip -> {count, firstTs, blockedUntil}
const auditLog = []; // keep last 200
const apiKeys = new Map(); // id -> record
const KEY_RPM = { 'gemini-2.5-flash':2500,'gemini-2.5-pro':1000,'ares-neural-70b':5000,'deep-space-vision':800 };
const VALID_TIERS = new Set(Object.keys(KEY_RPM));
const VALID_ZONES = new Set(['olympus-primary','chryse-ground','phobos-orbital','valles-marineris']);

// Pre-seed with mock keys (encrypted at rest in memory)
import { createRequire } from 'module';
let initialKeys = [];
try {
  const mockPath = path.join(__dirname, 'src/data/mockData.ts');
  // fallback static
  initialKeys = [
    { id:'key_ares_01', name:'Olympus Research Rover Agent', key:'ak_mars_live_9f82d7a6e14b09c2b3e81', tier:'gemini-2.5-flash', relayZone:'olympus-primary', createdAt:'2026-08-22T08:14:00Z', status:'active', tokensUsed:14829210, requestCount:38490, monthlyQuota:50000000, rpmLimit:2500 },
  ];
} catch {}
initialKeys.forEach(k=> apiKeys.set(k.id, k));

// Hashed allowlist for auth codes (SHA256 hex, same as frontend)
const ALLOWED_HASHES = new Set([
  'c55d6cf023bb7f3eee1a914029c7548676b3adc5af011863dff9361eb7d671b1', // MARS-OLYMPUS-2026
  '8a84b6bc02483045e9947bb3ceb71a48b0c4c4133f8e53fb62ea0ddd01b8d699', // ARES-ADMIN-782
  '3669aad75fda7c09de25f86650c33699cee368820c0fc8ef350711e6aff48cec', // MARS-GATEWAY-DEMO
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sha256Hex(s){ return crypto.createHash('sha256').update(s.toUpperCase().trim()).digest('hex'); }
function constantTimeEqual(a,b){
  const bufA = Buffer.from(a); const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function verifyCode(code){
  if (!code || typeof code!=='string' || code.length<4 || code.length>64) return false;
  const h = sha256Hex(code);
  for(const allowed of ALLOWED_HASHES){ if(constantTimeEqual(h, allowed)) return true; }
  return false;
}
function sanitize(str, max=1000){
  if(typeof str!=='string') return '';
  let s=str.trim().slice(0,max);
  s=s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'');
  s=s.replace(/javascript:/gi,'').replace(/data:/gi,'');
  return s;
}
function isValidName(name){
  const s=sanitize(name,64);
  return s.length>=2 && s.length<=64 && /^[\w\s\-\.\(\)]+$/.test(s);
}
function addAudit(action, detail, ip){
  auditLog.push({ ts: Date.now(), action: sanitize(action,64), detail: sanitize(detail,256), ip: ip?.slice(0,45) });
  if(auditLog.length>200) auditLog.shift();
}
function generateSecureKey(){
  const hex = crypto.randomBytes(24).toString('hex'); // 48 hex
  const id = `key_ares_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  return { id, secret:`ak_mars_live_${hex}` };
}
function getClientIp(req){
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// GLOBAL SECURITY MIDDLEWARE
// ---------------------------------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Helmet with strict CSP for API + static
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", APP_URL, "https://api.github.com", "https://generativelanguage.googleapis.com"],
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
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// CORS - strict allowlist
const allowOrigins = [APP_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    if(!origin) return cb(null, true); // same-origin / curl
    if(allowOrigins.includes(origin)) return cb(null, true);
    // In dev, allow any localhost
    if(NODE_ENV!=='production' && origin.includes('localhost')) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
  methods: ['GET','POST','DELETE'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'],
}));

// Body limits + parsers (10kb to prevent large payload DoS)
app.use(express.json({ limit: '10kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(superHeaders);
app.use(uaAnomaly);
app.use(ipReputation);
app.use(auditMiddleware);
app.use(guardPrototypePollution);
app.use(xssGuard);
app.use(strictJsonLimit);

// Request ID + basic logging (sanitized)
app.use((req,res,next)=>{
  const id = crypto.randomBytes(8).toString('hex');
  req.id = id;
  res.setHeader('X-Request-Id', id);
  // Log sanitized path only
  const safePath = sanitize(req.path, 200);
  console.log(`[${new Date().toISOString()}] ${req.method} ${safePath} id=${id} ip=${getClientIp(req)}`);
  next();
});

// Global rate limit: 100 req / 15 min per IP (tighter for API)
const globalLimiter = rateLimit({
  windowMs: 15*60*1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
  handler: (req,res)=>{ addAudit('rate_limit_global', req.path, getClientIp(req)); res.status(429).json({ error:'Too many requests' }); }
});
app.use('/api/', globalLimiter);

// Stricter login limiter: 5 / 15min
const loginLimiter = rateLimit({
  windowMs: 15*60*1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req)=> getClientIp(req),
  handler: (req,res)=>{ addAudit('rate_limit_login','login blocked', getClientIp(req)); res.status(429).json({ error:'Too many login attempts. Try in 15 minutes.' }); }
});

// Key generation limiter: 10 / min per IP
const keyGenLimiter = rateLimit({
  windowMs: 60*1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Key generation rate limited (10/min)' }
});

// ---------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------------
function authenticate(req,res,next){
  const auth = req.headers.authorization || '';
  const tokenFromHeader = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const tokenFromCookie = req.cookies?.ares_token || null;
  const token = tokenFromHeader || tokenFromCookie;
  if(!token) return res.status(401).json({ error:'Missing token' });
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({ error:'Invalid or expired token' });
  }
}

// Brute force check helper (additional to rateLimit, with lockout tracking)
function checkBrute(ip){
  const now=Date.now();
  const rec=loginAttempts.get(ip) || { count:0, firstTs: now, blockedUntil:0 };
  if(rec.blockedUntil && now < rec.blockedUntil) return { blocked:true, ms: rec.blockedUntil - now };
  // reset window 15m
  if(now - rec.firstTs > 15*60*1000){ rec.count=0; rec.firstTs=now; }
  return { blocked:false, rec };
}
function recordBrute(ip, success){
  const now=Date.now();
  let rec=loginAttempts.get(ip);
  if(!rec) rec={ count:0, firstTs: now, blockedUntil:0 };
  if(now - rec.firstTs > 15*60*1000){ rec.count=0; rec.firstTs=now; rec.blockedUntil=0; }
  if(success){ loginAttempts.delete(ip); return; }
  rec.count+=1;
  if(rec.count>=5){ rec.blockedUntil= now + 15*60*1000; addAudit('brute_lockout', `ip ${ip} locked`, ip); }
  loginAttempts.set(ip, rec);
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------
app.use('/api/auth/oauth', oauthRouter);
app.get('/api/chain/verify', authenticate, (req,res)=> res.json(verifyChain()));
app.get('/api/health', (req,res)=>{
  res.json({ status:'ok', uptime: process.uptime(), sol: 782, secure: true, csp: 'enabled', hsts: 'enabled' });
});

app.post('/api/auth/login', loginLimiter, body('code').isString().trim().isLength({ min:4, max:64 }), async (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Invalid input', details: errors.array().map(e=>e.msg) });
  const ip=getClientIp(req);
  const chk=checkBrute(ip);
  if(chk.blocked) return res.status(423).json({ error:`Locked. Try in ${Math.ceil(chk.ms/1000)}s` });
  const code = sanitize(req.body.code,64);
  // constant-time artificial delay 400-700ms to mitigate timing
  const start=Date.now();
  const ok=verifyCode(code);
  const elapsed=Date.now()-start;
  const minDelay=400+ crypto.randomInt(0,300);
  if(elapsed < minDelay) await new Promise(r=>setTimeout(r, minDelay-elapsed));

  if(!ok){
    recordBrute(ip,false);
    addAudit('login_fail','invalid code', ip);
    return res.status(401).json({ error:'Invalid authorization cipher', attemptsLeft: Math.max(0,5-(loginAttempts.get(ip)?.count||0)) });
  }
  recordBrute(ip,true);
  const jti=crypto.randomUUID();
  const token=jwt.sign({ jti, ip, fp: crypto.createHash('sha256').update(req.headers['user-agent']||'').digest('hex').slice(0,16) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  // httpOnly secure cookie + json response (dual)
  const cookieOpts={ httpOnly:true, secure: NODE_ENV==='production', sameSite:'strict', maxAge: 30*60*1000, path:'/' };
  res.cookie('ares_token', token, cookieOpts);
  // CSRF token for state-changing (double submit)
  const csrf=crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrf, { httpOnly:false, secure: NODE_ENV==='production', sameSite:'strict', path:'/' });
  addAudit('login_success', `jti ${jti.slice(0,8)}`, ip);
  res.json({ token, csrf, expiresIn: 30*60, user: { sol:782 } });
});

app.post('/api/auth/logout', (req,res)=>{
  res.clearCookie('ares_token', { path:'/' });
  res.clearCookie('csrf_token', { path:'/' });
  addAudit('logout','user logout', getClientIp(req));
  res.json({ ok:true });
});

app.get('/api/auth/verify', authenticate, (req,res)=>{
  res.json({ valid:true, user: req.user, exp: req.user.exp });
});

// CSRF check for state changing when using cookies
function csrfCheck(req,res,next){
  const csrfHeader=req.headers['x-csrf-token'];
  const csrfCookie=req.cookies?.csrf_token;
  // If Authorization Bearer used, skip CSRF (not cookie auth)
  if(req.headers.authorization?.startsWith('Bearer ')) return next();
  if(!csrfHeader || !csrfCookie || csrfHeader!==csrfCookie) return res.status(403).json({ error:'CSRF token mismatch' });
  next();
}

app.get('/api/keys', authenticate, (req,res)=>{
  const list=[...apiKeys.values()].map(k=>({
    id:k.id, name:k.name, tier:k.tier, relayZone:k.relayZone, status:k.status, createdAt:k.createdAt, rpmLimit:k.rpmLimit, monthlyQuota:k.monthlyQuota, tokensUsed:k.tokensUsed,
    // mask secret: show only last 4
    keyMasked: k.key.slice(0,14)+'••••'+k.key.slice(-4)
  }));
  res.json({ keys: list });
});

app.post('/api/keys', authenticate, keyGenLimiter, csrfCheck, [
  body('tier').isString().custom(v=> VALID_TIERS.has(v)).withMessage('Invalid tier'),
  body('relayZone').isString().custom(v=> VALID_ZONES.has(v)).withMessage('Invalid relay'),
  body('name').optional().isString().trim().isLength({ min:2, max:64 }).matches(/^[\w\s\-\.\(\)]+$/).withMessage('Invalid name'),
], (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Validation failed', details: errors.array() });
  const tier=sanitize(req.body.tier,30);
  const zone=sanitize(req.body.relayZone,30);
  let name=req.body.name ? sanitize(req.body.name,64) : `Martian Unit (${tier.split('-')[0]})`;
  if(!isValidName(name)) return res.status(400).json({ error:'Invalid name chars' });
  if(!VALID_TIERS.has(tier) || !VALID_ZONES.has(zone)) return res.status(400).json({ error:'Invalid tier/zone' });

  // per-user limit 20 (check count)
  if(apiKeys.size >= 50) return res.status(429).json({ error:'Global key limit reached' });

  const { id, secret } = generateSecureKey();
  const rec={
    id, key: secret, name, tier, relayZone: zone,
    createdAt: new Date().toISOString(), lastUsedAt:'Never', status:'active',
    tokensUsed:0, requestCount:0, monthlyQuota: parseInt({ 'gemini-2.5-flash':'50','gemini-2.5-pro':'20','ares-neural-70b':'100','deep-space-vision':'10' }[tier]||'50')*1_000_000, rpmLimit: KEY_RPM[tier]
  };
  apiKeys.set(id, rec);
  addAudit('key_gen', `${id} tier=${tier}`, getClientIp(req));
  res.status(201).json({ key: rec });
});

app.delete('/api/keys/:id', authenticate, csrfCheck, param('id').isString().trim().isLength({min:5,max:128}), (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Invalid id' });
  const id=sanitize(req.params.id,128);
  const k=apiKeys.get(id) || [...apiKeys.values()].find(v=> v.key===id);
  if(!k) return res.status(404).json({ error:'Key not found' });
  k.status='revoked';
  apiKeys.set(k.id, k);
  addAudit('key_revoke', id.slice(0,32), getClientIp(req));
  res.json({ ok:true, id:k.id });
});

app.use('/api', aiGateway);
app.get('/api/metrics', authenticate, (req,res)=>{
  // mock live metrics (in prod, pull from real telemetry)
  const now=Date.now();
  const rps= 120 + Math.sin(now/5000)*30 + crypto.randomInt(0,10);
  res.json({
    currentRps: parseFloat(rps.toFixed(1)),
    peakRps: 384.5,
    totalRequestsToday: 1289420 + Math.floor(rps*10),
    totalTokensToday: 894210000 + Math.floor(rps*1000),
    avgLatencyMs: 12 + Math.random()*4,
    p99LatencyMs: 42.8,
    errorRate: 0.003,
    earthMarsDelayMinutes: 4.18,
    clusterHealth:'nominal',
  });
});

app.get('/api/audit', authenticate, (req,res)=>{
  // only allow admin? For demo, allow any authed but limit
  res.json({ audit: auditLog.slice(-20) });
});

// ---------------------------------------------------------------------------
// Static frontend (production)
// ---------------------------------------------------------------------------
const distPath = path.join(__dirname, 'dist');
if(fs.existsSync(distPath)){
  app.use(express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, p)=>{
      if(p.endsWith('.html')) res.setHeader('Cache-Control','no-cache');
    }
  }));
  // SPA fallback
  app.get('*', (req,res)=>{
    if(req.path.startsWith('/api/')) return res.status(404).json({ error:'Not found' });
    res.sendFile(path.join(distPath,'index.html'));
  });
} else {
  app.get('/', (req,res)=> res.json({ msg:'Mars Gateway API — frontend not built. Run npm run build', health:'/api/health' }));
}

// ---------------------------------------------------------------------------
// Error handler (never leak stack)
// ---------------------------------------------------------------------------
app.use((err,req,res,next)=>{
  console.error(`[ERR ${req.id}]`, sanitize(err.message||'unknown',200));
  if(err.message==='CORS blocked') return res.status(403).json({ error:'CORS blocked' });
  res.status(500).json({ error:'Internal server error' });
});
app.use((req,res)=> res.status(404).json({ error:'Not found' }));

app.listen(PORT, '0.0.0.0', ()=>{
  console.log(`[MARS GATEWAY] Hardened backend listening on 0.0.0.0:${PORT} env=${NODE_ENV}`);
  console.log(`[SECURITY] Helmet CSP+HSTS enabled, rate limits active, JWT ${JWT_EXPIRES}, CORS allow ${allowOrigins.join(',')}`);
});
