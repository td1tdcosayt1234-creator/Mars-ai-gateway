// tenantQuota.js - Per-key token quota + RPM enforcement for AI gateway
// Prevents cost abuse, enforces tier quotas, sliding window
const usage = new Map(); // keyId -> { tokensToday, requestsToday, window: [{ts}], dailyReset: ts }

const TIER_QUOTA = { 'gemini-2.5-flash': 50000000, 'gemini-2.5-pro': 20000000, 'ares-neural-70b': 100000000, 'deep-space-vision': 10000000 };
const TIER_RPM = { 'gemini-2.5-flash': 2500, 'gemini-2.5-pro': 1000, 'ares-neural-70b': 5000, 'deep-space-vision': 800 };

function getRecord(keyId){
  const now=Date.now();
  let r=usage.get(keyId);
  if(!r || now - r.dailyReset > 24*60*60*1000){
    r={ tokensToday:0, requestsToday:0, window:[], dailyReset: now };
    usage.set(keyId, r);
  }
  // prune RPM window 60s
  r.window = r.window.filter(t=> now - t < 60*1000);
  return r;
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

  if(rec.tokensToday + est > quota){
    return res.status(429).json({ error:'Quota exceeded', quota, used: rec.tokensToday, tier: tierKey });
  }
  if(rec.window.length >= rpm){
    return res.status(429).json({ error:'RPM limit exceeded', rpm, window: rec.window.length });
  }
  // reserve
  rec.tokensToday += est;
  rec.requestsToday +=1;
  rec.window.push(Date.now());
  req.quota = { tier: tierKey, est, rpm, quota };
  next();
}

export function getQuotaStatus(keyId){
  const r=usage.get(keyId);
  if(!r) return null;
  return { tokensToday: r.tokensToday, requestsToday: r.requestsToday, rpmWindow: r.window.length };
}
