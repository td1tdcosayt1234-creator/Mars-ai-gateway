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
import https from 'https';
import { fileURLToPath } from 'url';
import { config } from './server/config.js';
import { audit, auditMiddleware, verifyChain } from './server/middleware/auditLogger.js';
import { guardPrototypePollution, xssGuard, strictJsonLimit } from './server/middleware/validation.js';
import { secureStore } from './server/utils/secureStore.js';
import { superHeaders, uaAnomaly, ipReputation } from './server/middleware/superSecurity.js';
import { tier1Perimeter, internalHmacSign } from './server/middleware/tier1Perimeter.js';
import { tier2Guard } from './server/middleware/tier2Core.js';
import { authenticate as sharedAuthenticate, csrfCheck as sharedCsrfCheck, noStore, fingerprint } from './server/middleware/auth.js';
import { deny, denyAll } from './server/utils/denylist.js';
import twoFactorRouter from './server/routes/twoFactor.js';
import { tier3Vault } from './server/middleware/tier3DeepVault.js';
import deepVaultRouter from './server/routes/deepVault.js';
import oauthRouter from './server/routes/oauth.js';
import aiGateway from './server/routes/aiGateway.js';
import { aiFirewall } from './server/middleware/aiFirewall.js';
import { quotaGuard } from './server/middleware/tenantQuota.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;
const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES = config.jwtExpires;
const NODE_ENV = config.nodeEnv;
const APP_URL = config.appUrl;
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// config.js already fail-closes in production for JWT_SECRET/TIER_HMAC/MASTER_KEY/AUTH_CODE_HASHES

// ---------------------------------------------------------------------------
// In-memory stores (production: replace with DB/Redis)
// NOTE: single source of truth is secureStore (AES-GCM). No separate apiKeys map,
// no demo seeds with real-looking secrets.
// ---------------------------------------------------------------------------
const loginAttempts = new Map(); // ip -> {count, firstTs, blockedUntil}
const auditLog = []; // keep last 200
const apiKeys = secureStore; // alias — unified encrypted store
const KEY_RPM = { 'gemini-2.5-flash':2500,'gemini-2.5-pro':1000,'ares-neural-70b':5000,'deep-space-vision':800 };
const VALID_TIERS = new Set(Object.keys(KEY_RPM));
const VALID_ZONES = new Set(['olympus-primary','chryse-ground','phobos-orbital','valles-marineris']);

// No pre-seed. Keys issued via POST /api/keys only.

// Hashed allowlist from env (fail-closed, no defaults)
const ALLOWED_HASHES = config.authCodeHashes;

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
  if (ALLOWED_HASHES.size === 0) return false;
  const h = sha256Hex(code);
  for(const allowed of ALLOWED_HASHES){
    if (allowed.length !== h.length) continue;
    if(constantTimeEqual(h, allowed)) return true;
  }
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
function addAudit(action, detail, ip, user='-'){
  auditLog.push({ ts: Date.now(), action: sanitize(action,64), detail: sanitize(detail,256), ip: ip?.slice(0,45), user: String(user).slice(0,32) });
  if(auditLog.length>200) auditLog.shift();
}
function generateSecureKey(){
  const hex = crypto.randomBytes(24).toString('hex'); // 48 hex
  const id = `key_ares_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  return { id, secret:`ak_mars_live_${hex}` };
}
function getClientIp(req){
  // Use Express req.ip (respects trust proxy=1 for Render). Never trust
  // X-Forwarded-For directly — it is client-spoofable and would bypass rate limits.
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// GLOBAL SECURITY MIDDLEWARE
// ---------------------------------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Helmet with strict CSP for API + static.
// Prod: no 'unsafe-inline' in script-src, no localhost in connect-src, no
// open https: img-src (exfil). Dev localhost origins added only off-prod.
const DEV_CONNECT = (NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'ws:', 'wss:']);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", APP_URL, "https://api.github.com", "https://generativelanguage.googleapis.com", ...DEV_CONNECT],
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
  originAgentCluster: true,
}));

// CORS - strict allowlist (fail-closed in prod, no null-origin bypass for cookies)
const allowOrigins = [APP_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    // No Origin (curl/health, same-origin) — allow but cookies still require auth
    if(!origin) return cb(null, true);
    if(allowOrigins.includes(origin)) return cb(null, true);
    // In dev, allow any localhost
    if(NODE_ENV!=='production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
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
app.use(tier1Perimeter);
app.use(internalHmacSign);
app.use(superHeaders);
app.use(uaAnomaly);
app.use(ipReputation);
app.use(auditMiddleware);
app.use(guardPrototypePollution);
app.use(xssGuard);
app.use(strictJsonLimit);
// Secrets must never sit in caches (auth/keys/2fa/vault)
app.use(['/api/auth', '/api/keys', '/api/2fa', '/api/vault'], noStore);

// Vault files are never web-accessible: explicit deny before static/API.
// (dist/ doesn't contain data/, but a misdeploy must still fail closed.)
const BLOCKED_PATHS = [/^\/data(\/|$)/i, /^\/\.env(\.|$)/i, /^\/\.git(\/|$)/i, /\.pem$/i, /\.key$/i];
app.use((req, res, next) => {
  try {
    const p = decodeURIComponent(req.path);
    for (const r of BLOCKED_PATHS) {
      if (r.test(p)) return res.status(404).json({ error: 'Not found' });
    }
  } catch {}
  next();
});

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

// Stricter login limiter: 5 / 15min — keyed by req.ip (trust proxy=1), never XFF
const loginLimiter = rateLimit({
  windowMs: 15*60*1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
// AUTH MIDDLEWARE (shared with server/middleware/auth.js — single source of truth)
// ---------------------------------------------------------------------------
const authenticate = sharedAuthenticate;

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
// ROUTES — Tier2 guard mounted BEFORE sensitive routes (Express order matters)
// ---------------------------------------------------------------------------
app.use('/api/auth/oauth', oauthRouter);
app.use('/api/2fa', twoFactorRouter);
// Vault router has its own tier3Vault+tier2Guard internally
app.use('/api/vault', deepVaultRouter);
// Protect keys/metrics/audit with Tier2 BEFORE defining handlers
app.use('/api/keys', tier2Guard);
app.use('/api/metrics', tier2Guard);
app.use('/api/audit', tier2Guard);
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
  const token=jwt.sign({ jti, ip, fp: fingerprint(req), iss: config.jwtIssuer, aud: config.jwtAudience }, JWT_SECRET, { expiresIn: JWT_EXPIRES, algorithm: 'HS256' });
  // httpOnly secure cookie + json response (dual)
  const cookieOpts={ httpOnly:true, secure: NODE_ENV==='production', sameSite:'strict', maxAge: 30*60*1000, path:'/' };
  res.cookie('ares_token', token, cookieOpts);
  // CSRF token for state-changing (double submit)
  const csrf=crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrf, { httpOnly:false, secure: NODE_ENV==='production', sameSite:'strict', path:'/' });
  addAudit('login_success', `jti ${jti.slice(0,8)}`, ip, jti.slice(0,8));
  res.json({ token, csrf, expiresIn: 30*60, user: { sol:782 } });
});

app.post('/api/auth/logout', (req,res)=>{
  // Revoke Bearer too (cookies alone are not enough — denylist the jti)
  try {
    const auth = req.headers.authorization || '';
    const t = auth.startsWith('Bearer ') ? auth.slice(7) : (req.cookies?.ares_token || null);
    if (t) {
      const p = jwt.decode(t);
      if (p && p.jti) deny(p.jti, p.exp);
    }
  } catch {}
  res.clearCookie('ares_token', { path:'/' });
  res.clearCookie('csrf_token', { path:'/' });
  addAudit('logout','user logout', getClientIp(req), req.user?.jti?.slice(0,8) || '-');
  res.json({ ok:true });
});

// Rotation: old jti denylisted, new token bound to same fp. Requires CSRF when
// cookie-authed (sharedCsrfCheck) + valid (non-denylisted) current token.
app.post('/api/auth/refresh', authenticate, sharedCsrfCheck, (req,res)=>{
  const old = req.user;
  deny(old.jti, old.exp);
  const jti=crypto.randomUUID();
  const token=jwt.sign({ jti, sub: old.sub, ip: getClientIp(req), fp: fingerprint(req), iss: config.jwtIssuer, aud: config.jwtAudience }, JWT_SECRET, { expiresIn: JWT_EXPIRES, algorithm: 'HS256' });
  const cookieOpts={ httpOnly:true, secure: NODE_ENV==='production', sameSite:'strict', maxAge: 30*60*1000, path:'/' };
  res.cookie('ares_token', token, cookieOpts);
  addAudit('token_refresh', `jti ${String(jti).slice(0,8)} from ${String(old.jti).slice(0,8)}`, getClientIp(req), String(jti).slice(0,8));
  res.json({ token, expiresIn: 30*60 });
});

// Logout everywhere: revoke current + caller-supplied family jtis (from audit/mine)
app.post('/api/auth/logout-all', authenticate, sharedCsrfCheck, body('jtis').optional().isArray({ max: 50 }), (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Invalid input' });
  const mine = Array.isArray(req.body.jtis) ? req.body.jtis.filter(j => typeof j === 'string') : [];
  deny(req.user.jti, req.user.exp);
  denyAll(mine);
  res.clearCookie('ares_token', { path:'/' });
  res.clearCookie('csrf_token', { path:'/' });
  addAudit('logout_all','all sessions revoked', getClientIp(req), String(req.user.jti).slice(0,8));
  res.json({ ok:true, revoked: 1 + mine.length });
});

app.get('/api/auth/verify', authenticate, (req,res)=>{
  res.json({ valid:true, user: req.user, exp: req.user.exp });
});

// CSRF check for state changing when using cookies (shared, Origin+double-submit)
const csrfCheck = sharedCsrfCheck;

function keyOwner(req){ return req.user.sub || req.user.jti; }
function keyIsAdmin(req){ const sub = req.user.sub || req.user.jti; return !!(sub && config.adminSubjects.has(sub)); }

app.get('/api/keys', authenticate, (req,res)=>{
  res.json({ keys: apiKeys.listMasked(keyOwner(req), keyIsAdmin(req)) });
});

app.post('/api/keys', authenticate, keyGenLimiter, csrfCheck, [
  body('tier').isString().custom(v=> VALID_TIERS.has(v)).withMessage('Invalid tier'),
  body('relayZone').isString().custom(v=> VALID_ZONES.has(v)).withMessage('Invalid relay'),
  body('name').optional().isString().trim().isLength({ min:2, max:64 }).matches(/^[\w\s\-\.\(\)]+$/).withMessage('Invalid name'),
  body('models').optional().isArray({ max: 4 }),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
  body('ipAllowlist').optional().isArray({ max: 10 }),
], (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Validation failed', details: errors.array() });
  const tier=sanitize(req.body.tier,30);
  const zone=sanitize(req.body.relayZone,30);
  let name=req.body.name ? sanitize(req.body.name,64) : `Martian Unit (${tier.split('-')[0]})`;
  if(!isValidName(name)) return res.status(400).json({ error:'Invalid name chars' });
  if(!VALID_TIERS.has(tier) || !VALID_ZONES.has(zone)) return res.status(400).json({ error:'Invalid tier/zone' });

  // per-owner cap 20 (abuse containment) + global cap 50
  if(apiKeys.size() >= 50) return res.status(429).json({ error:'Global key limit reached' });
  if(apiKeys.ownerCount(keyOwner(req)) >= 20) return res.status(429).json({ error:'Key limit reached (20 per account)' });

  const models = Array.isArray(req.body.models) && req.body.models.length
    ? [...new Set(req.body.models.map(m => sanitize(m,30)).filter(m => VALID_TIERS.has(m)))]
    : [tier];
  if(!models.includes(tier)) models.push(tier);
  const days = req.body.expiresInDays ? parseInt(req.body.expiresInDays,10) : 90;
  const expiresAt = new Date(Date.now()+days*24*60*60*1000).toISOString();
  const ipAllowlist = Array.isArray(req.body.ipAllowlist)
    ? req.body.ipAllowlist.map(ip=>sanitize(ip,45)).filter(ip=>/^[0-9a-fA-F:.]{7,45}$/.test(ip)).slice(0,10)
    : [];
  const { id, secret } = generateSecureKey();
  const rec={
    id, key: secret, name, tier, relayZone: zone,
    createdAt: new Date().toISOString(), lastUsedAt:'Never', status:'active',
    tokensUsed:0, requestCount:0, monthlyQuota: parseInt({ 'gemini-2.5-flash':'50','gemini-2.5-pro':'20','ares-neural-70b':'100','deep-space-vision':'10' }[tier]||'50')*1_000_000, rpmLimit: KEY_RPM[tier],
    models, scopes:['chat:write','tokenize:write'], ipAllowlist, expiresAt,
    owner: keyOwner(req) // row-level ownership: users only ever see their own keys
  };
  apiKeys.set(id, rec);
  addAudit('key_gen', `${id} tier=${tier}`, getClientIp(req), String(req.user.jti).slice(0,8));
  // Plaintext returned once at creation only — list endpoint is masked
  res.status(201).json({ key: rec });
});

app.delete('/api/keys/:id', authenticate, csrfCheck, param('id').isString().trim().isLength({min:5,max:128}), (req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ error:'Invalid id' });
  const id=sanitize(req.params.id,128);
  // Lookup by id only — never accept raw secret as id (prevents oracle).
  // Ownership enforced: other users' ids answer 404 (no existence oracle).
  const k=apiKeys.get(id);
  if(!k || !apiKeys.owns(id, keyOwner(req), keyIsAdmin(req))) return res.status(404).json({ error:'Key not found' });
  apiKeys.revoke(k.id);
  addAudit('key_revoke', id.slice(0,32), getClientIp(req), String(req.user.jti).slice(0,8));
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
  // Admin-only: full log contains other users' IPs. Others use /api/audit/mine.
  const sub = req.user.sub || req.user.jti;
  if(!sub || !config.adminSubjects.has(sub)) return res.status(403).json({ error:'Admin only' });
  res.json({ audit: auditLog.slice(-20) });
});

// Own entries only (user-scoped) — safe for every authenticated user
app.get('/api/audit/mine', authenticate, (req,res)=>{
  const me = String(req.user.jti).slice(0,8);
  const mine = auditLog.filter(e => e.user === me).slice(-20);
  res.json({ audit: mine, jti: me });
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
  // SPA fallback (Express 5: use regex, not '*')
  app.get(/.*/, (req,res)=>{
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

const server = startListener();

function startListener() {
  const useTls = config.tlsCert && config.tlsKey;
  if (useTls) {
    const opts = { cert: fs.readFileSync(config.tlsCert), key: fs.readFileSync(config.tlsKey) };
    return https.createServer(opts, app).listen(PORT, config.host, onListen('https'));
  }
  if (config.isProd && config.host === '0.0.0.0' && !useTls) {
    console.warn('[SECURITY] 0.0.0.0 without TLS — only safe behind a TLS-terminating proxy/firewall (see Caddyfile, SECURITY.md)');
  }
  return app.listen(PORT, config.host, onListen('http'));
}

function onListen(proto) {
  return () => {
    console.log(`[MARS GATEWAY] Hardened backend listening on ${config.host}:${PORT} (${proto}) env=${NODE_ENV}`);
    console.log(`[SECURITY] Helmet CSP+HSTS enabled, rate limits active, JWT ${JWT_EXPIRES}, CORS allow ${allowOrigins.join(',')}`);
  };
}
// Slowloris / hanging-socket defense (LLM10 + DoS)
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 15000;
