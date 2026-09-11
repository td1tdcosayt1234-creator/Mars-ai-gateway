// tenantQuota.js - Token-bucket + quota + global breaker + anomaly (LLM10)
// Prevents unbounded consumption / cost burn. Per-key TPM + RPM + daily quota,
// global TPM breaker, EMA anomaly auto-throttle. Persisted (quota.json).
// Multi-instance must set REDIS_URL (atomic INCR) — see redisClient.js.
import { loadJson, saveJson } from '../utils/durable.js';
import { audit } from './auditLogger.js';

const usage = new Map(); // keyId -> { tokensToday, requestsToday, window: [{ts}], dailyReset: ts }
try {
  const saved = loadJson('quota.json', []);
  for (const [k, v] of saved) {
    if (typeof k === 'string' && v && typeof v.tokensToday === 'number') usage.set(k, v);
  }
} catch {}
let persistT = null;
function persistQuota() {
  if (persistT) return;
  persistT = setTimeout(() => {
    persistT = null;
    try { saveJson('quota.json', [...usage.entries()].slice(-1000)); } catch {}
  }, 5000);
}

const TIER_QUOTA = { 'gemini-2.5-flash': 50000000, 'gemini-2.5-pro': 20000000, 'ares-neural-70b': 100000000, 'deep-space-vision': 10000000 };
const TIER_RPM = { 'gemini-2.5-flash': 2500, 'gemini-2.5-pro': 1000, 'ares-neural-70b': 5000, 'deep-space-vision': 800 };
// Tokens-per-minute per tier (LLM10: cost burn is tokens, not requests)
const TIER_TPM = { 'gemini-2.5-flash': 200000, 'gemini-2.5-pro': 100000, 'ares-neural-70b': 500000, 'deep-space-vision': 80000 };
const GLOBAL_TPM = parseInt(process.env.GLOBAL_TPM || '1000000', 10); // all keys combined / min
const globalWindow = []; // timestamps+tokens: [{ts, tokens}]

function getRecord(keyId){
  const now=Date.now();
  let r=usage.get(keyId);
  if(!r || now - r.dailyReset > 24*60*60*1000){
    r={ tokensToday:0, requestsToday:0, window:[], tpmWindow:[], ema:500, anomalies:0, suspendedUntil:0, dailyReset: now };
    usage.set(keyId, r);
  }
  // prune RPM window 60s + TPM window 60s
  r.window = r.window.filter(t=> now - t < 60*1000);
  r.tpmWindow = (r.tpmWindow || []).filter(e=> now - e.ts < 60*1000);
  return r;
}

function globalTpm(){
  const now=Date.now();
  while(globalWindow.length && now - globalWindow[0].ts > 60*1000) globalWindow.shift();
  return globalWindow.reduce((a,e)=> a+e.tokens, 0);
}

export function estimateTokens(text){
  if(!text) return 0;
  // Rough: 1 token ~4 chars, plus overhead
  return Math.ceil(text.length/4);
}

export function quotaGuard(req,res,next){
  const key = req.apikey || req.user; // from auth or apiKeyAuth
  const keyId = req.headers['x-api-key'] || req.user?.jti || req.body?.keyId || 'anon';
  const tier = req.body?.model || req.body?.tier || 'gemini-2.5-flash';
  // Map model to tier
  const tierKey = tier.includes('flash')?'gemini-2.5-flash': tier.includes('pro')?'gemini-2.5-pro': tier.includes('70b')?'ares-neural-70b': tier.includes('vision')?'deep-space-vision':'gemini-2.5-flash';
  const prompt = req.body?.prompt || req.body?.messages?.[0]?.content || '';
  const est = estimateTokens(prompt) + 500; // reserve completion

  const rec=getRecord(keyId);
  const quota=TIER_QUOTA[tierKey]||50000000;
  const rpm=TIER_RPM[tierKey]||1000;
  const tpm=TIER_TPM[tierKey]||100000;

  // Suspended keys (anomaly auto-throttle) fail-closed
  if(rec.suspendedUntil && Date.now() < rec.suspendedUntil){
    return res.status(429).json({ error:'Key suspended (anomaly). Contact admin.', retry: Math.ceil((rec.suspendedUntil-Date.now())/1000) });
  }
  if(rec.tokensToday + est > quota){
    return res.status(429).json({ error:'Quota exceeded', quota, used: rec.tokensToday, tier: tierKey });
  }
  if(rec.window.length >= rpm){
    return res.status(429).json({ error:'RPM limit exceeded', rpm, window: rec.window.length });
  }
  const usedTpm = (rec.tpmWindow||[]).reduce((a,e)=> a+e.tokens, 0);
  if(usedTpm + est > tpm){
    return res.status(429).json({ error:'TPM limit exceeded (token burn)', tpm, used: usedTpm });
  }
  if(globalTpm() + est > GLOBAL_TPM){
    return res.status(503).json({ error:'Gateway saturated (global breaker). Retry later.' });
  }
  // Anomaly: 5x EMA and >10k TPM = likely compromised key or runaway loop
  const baseline = rec.ema || 500;
  if(usedTpm > Math.max(10000, baseline*5)){
    rec.anomalies = (rec.anomalies||0)+1;
    try { audit('quota_anomaly', `key=${String(keyId).slice(0,8)} tpm=${usedTpm} ema=${Math.round(baseline)} n=${rec.anomalies}`, req.ip, String(keyId)); } catch {}
    if(rec.anomalies >= 3){
      rec.suspendedUntil = Date.now() + 15*60*1000;
      rec.anomalies = 0;
      persistQuota();
      return res.status(429).json({ error:'Key suspended (anomaly x3). Contact admin.' });
    }
  }
  // EMA update + reserve
  rec.ema = baseline*0.9 + usedTpm*0.1;
  rec.tokensToday += est;
  rec.requestsToday +=1;
  rec.window.push(Date.now());
  rec.tpmWindow.push({ ts: Date.now(), tokens: est });
  globalWindow.push({ ts: Date.now(), tokens: est });
  req.quota = { tier: tierKey, est, rpm, quota, tpm };
  persistQuota();
  next();
}

export function getQuotaStatus(keyId){
  const r=usage.get(keyId);
  if(!r) return null;
  return { tokensToday: r.tokensToday, requestsToday: r.requestsToday, rpmWindow: r.window.length };
}
