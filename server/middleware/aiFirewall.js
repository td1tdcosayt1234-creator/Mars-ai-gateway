// aiFirewall.js - AI Gateway specific firewall for Mars Deep Space Relay
// Blocks prompt injection, jailbreak, system leak, PII exfil, toxicity
import crypto from 'crypto';

// Prompt injection patterns (OWASP LLM Top 10)
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+instructions/i,
  /system\s*prompt/i,
  /reveal\s+system/i,
  /developer\s+mode/i,
  /DAN\s*mode/i,
  /jailbreak/i,
  /bypass\s+safety/i,
  /roleplay\s+as\s+(system|assistant|admin)/i,
  /you\s+are\s+now\s+(?:a|an)\s+\w+/i,
  /do\s+anything\s+now/i,
  /pretend\s+to\s+be/i,
  /disregard\s+safety/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
  /output\s+your\s+initial\s+prompt/i,
  /print\s+your\s+instructions/i,
];

const TOXIC_PATTERNS = [
  /how\s+to\s+make\s+(?:a\s+)?bomb/i,
  /how\s+to\s+hack/i,
  /illicit\s+drug\s+manufacture/i,
];

// PII regex (redact, not block)
const PII_REGEX = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit: /\b(?:\d[ -]*?){13,19}\b/g,
  apiKey: /\b(?:ak_mars_live_|sk-|ghp_)[a-zA-Z0-9_\-]{10,}\b/g,
};

function scoreInjection(prompt){
  let score=0; let hits=[];
  for(const pat of INJECTION_PATTERNS){ if(pat.test(prompt)){ score+=25; hits.push(pat.source.slice(0,30)); } }
  for(const pat of TOXIC_PATTERNS){ if(pat.test(prompt)){ score+=40; hits.push(pat.source.slice(0,30)); } }
  // Heuristic: many imperative commands
  if((prompt.match(/must|should|need to|have to/gi)||[]).length>5) score+=10;
  return { score: Math.min(100,score), hits };
}

export function redactPII(text){
  let out=text;
  let found=[];
  for(const [type, re] of Object.entries(PII_REGEX)){
    const m=[...out.matchAll(re)];
    if(m.length){ found.push(`${type}:${m.length}`); out=out.replace(re, `[REDACTED_${type.toUpperCase()}]`); }
  }
  return { text: out, pii: found };
}

export function aiFirewall(req,res,next){
  const prompt = req.body?.prompt || req.body?.messages?.[0]?.content || req.body?.content || '';
  const model = req.body?.model || '';
  if(!prompt) return next(); // let validator handle
  if(typeof prompt!=='string' || prompt.length>8000) return res.status(400).json({ error:'Prompt too large (max 8000)' });

  // 1. Injection score
  const { score, hits } = scoreInjection(prompt);
  if(score>=50){
    console.warn(`[AI_FIREWALL] BLOCK injection score=${score} hits=${hits.join(',')} ip=${req.ip}`);
    return res.status(400).json({ error:'Blocked: prompt injection detected', score, hits: hits.slice(0,3) });
  }
  // 2. PII redact (don't block, but log & redact for audit)
  const { text: clean, pii } = redactPII(prompt);
  if(pii.length){
    req.body._piiDetected = pii;
    // Optionally redact before proxying to upstream LLM
    if(req.body.prompt) req.body.prompt = clean;
    if(req.body.messages?.[0]?.content) req.body.messages[0].content = clean;
    console.log(`[PII_REDACT] ${pii.join(',')} ip=${req.ip}`);
  }
  req.aiScore = score;
  next();
}

// For gateway proxy responses: strip system leakage
export function sanitizeAIResponse(text){
  if(typeof text!=='string') return text;
  return text.replace(/system\s+prompt/gi,'[filtered]').replace(/internal\s+instructions/gi,'[filtered]').slice(0,10000);
}
