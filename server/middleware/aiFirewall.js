// aiFirewall.js - AI Gateway firewall (OWASP LLM01/02/05/06/07/10)
// Blocks prompt injection (direct+indirect), jailbreak, system leak, PII exfil,
// toxicity, and unsafe model output (XSS/SSRF/markdown exfil). Default-deny tools.
import { extractAllUserText } from '../utils/aiSanitizer.js';

// Direct injection (LLM01). Weighted — multiple weak signals still block.
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+(instructions|prompts|rules|directives)/i,
  /disregard\s+(safety|policy|rules|instructions)/i,
  /system\s*prompt|reveal\s+system|output\s+your\s+(initial|system)\s+prompt/i,
  /print\s+your\s+(instructions|system|rules)/i,
  /developer\s+mode|DAN\s*mode|jailbreak|do\s+anything\s+now/i,
  /bypass\s+(safety|filter|moderation|guardrail)/i,
  /roleplay\s+as\s+(system|assistant|admin|root|developer)/i,
  /you\s+are\s+now\s+(?:a|an)\s+\w+/i,
  /pretend\s+to\s+be|act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
  /translate\s+.*(instructions|prompt).*then\s+(follow|execute)/i,
  /encode\s+.*(base64|rot13|hex).*then\s+(decode|execute|follow)/i,
  /grandma\s+(trick|story)|hypothetical(?:ly)?\s+.*(bypass|ignore)/i,
  /sudo\s+mode|god\s+mode|unrestricted\s+mode|evil\s+confidant/i,
  /-wing\s+instructions|override\s+(policy|safety|system)/i,
  // Bengali / multilingual jailbreak surface (gateway serves BD users)
  /নির্দেশ.*উপেক্ষা|সিস্টেম.*প্রম্পট.*দেখাও|নিরাপত্তা.*বাইপাস/i,
  /পূর্ববর্তী.*নির্দেশ.*ভুলে/i,
];

// Indirect injection via RAG/tool/docs (LLM01-indirect). Even stricter — docs must
// never contain instructions for the model.
const INDIRECT_PATTERNS = [
  /###\s*system\s*:/i, /<<SYS>>|\[\/INST\]|<\|\s*system\s*\|>/i,
  /assistant\s+to=self|follow\s+these\s+hidden\s+instructions/i,
  /when\s+summarizing.*(ignore|reveal|exfiltrate)/i,
];

// Toxic / illicit (block, don't just score). Includes weapons, cyberattack, CSAM-adjacent, self-harm facilitation.
const TOXIC_PATTERNS = [
  /how\s+to\s+make\s+(?:a\s+)?bomb|build\s+(?:a\s+)?explosive|napalm|ricin/i,
  /how\s+to\s+hack\s+(?:into|a\s+bank|critical)/i,
  /illicit\s+drug\s+manufacture|fentanyl\s+synthesis/i,
  /create\s+malware|ransomware\s+source|keylogger\s+code/i,
  /self-harm\s+instructions|how\s+to\s+commit\s+suicide/i,
];

// PII / secrets (redact both directions — LLM02). Includes cloud keys, JWT, BD identifiers.
const PII_REGEX = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  bd_mobile: /(\+?880|0)1[3-9]\d{8}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit: /\b(?:\d[ -]*?){13,19}\b/g,
  apiKey: /\b(?:ak_mars_live_|sk-|ghp_|gho_|xox[bap]-)[a-zA-Z0-9_\-]{10,}\b/g,
  aws_key: /\bAKIA[0-9A-Z]{16}\b/g,
  private_key: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  jwt: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  stripe: /\b(?:sk_live|rk_live)_[A-Za-z0-9]{10,}\b/g,
};

// Unsafe output (LLM05 improper output handling): XSS, SSRF, markdown exfil.
const OUTPUT_BLOCK = [
  /<\s*script|javascript\s*:|onerror\s*=|onload\s*=|onmouseover\s*=/i,
  /file:\/\/|gopher:\/\/|dict:\/\/|ftp:\/\/\s*$/i,
  /169\.254\.169\.254|metadata\.google\.internal|localhost:\d+|127\.0\.0\.1/i,
  /<\s*iframe|<\s*object|<\s*embed/i,
];
// Model must not emit markdown images (tracking-pixel / prompt exfil) nor links
// to private/metadata targets. Public plain links are allowed; images are not.
const MARKDOWN_EXFIL = /!\[[^\]]*\]\(\s*https?:[^)]+\)|\[[^\]]+\]\(\s*https?:\/\/(?:169\.254|127\.|localhost|10\.|192\.168|172\.(1[6-9]|2\d|3[01]))[^)]*\)/i;

function scoreInjection(text){
  let score=0; const hits=[];
  for(const pat of INJECTION_PATTERNS){ if(pat.test(text)){ score+=25; hits.push(pat.source.slice(0,30)); } }
  for(const pat of INDIRECT_PATTERNS){ if(pat.test(text)){ score+=35; hits.push('indirect:'+pat.source.slice(0,22)); } }
  for(const pat of TOXIC_PATTERNS){ if(pat.test(text)){ score+=60; hits.push(pat.source.slice(0,30)); } }
  // Encoded-payload anomaly: long base64 blob = smuggled instructions (LLM01)
  if(/(?:[A-Za-z0-9+/]{100,}={0,2})/.test(text)) { score+=20; hits.push('base64_blob'); }
  // Heuristic: many imperative commands
  if((text.match(/must|should|need to|have to/gi)||[]).length>5) score+=10;
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
  // Scan ALL user-supplied text (prompt + every message + RAG docs), not just first.
  const fullText = extractAllUserText(req.body || {});
  if(!fullText) return next(); // let validator handle empty
  if(typeof fullText!=='string' || fullText.length>16000) return res.status(400).json({ error:'Prompt too large (max 8000 per field, 16k total)' });

  // 1. Injection score (direct + indirect + toxic)
  const { score, hits } = scoreInjection(fullText);
  if(score>=50){
    console.warn(`[AI_FIREWALL] BLOCK injection score=${score} hits=${hits.join(',')} ip=${req.ip}`);
    return res.status(400).json({ error:'Blocked: prompt injection detected', score, hits: hits.slice(0,3) });
  }
  // 2. PII redact everywhere (don't block, but log & redact before upstream)
  const { text: clean, pii } = redactPII(fullText);
  if(pii.length){
    req.body._piiDetected = pii;
    // Redact in place across all fields
    if(typeof req.body.prompt === 'string') req.body.prompt = redactPII(req.body.prompt).text.slice(0,4000);
    if(typeof req.body.content === 'string') req.body.content = redactPII(req.body.content).text.slice(0,4000);
    if(Array.isArray(req.body.messages)){
      for(const m of req.body.messages){
        if(m && typeof m.content === 'string') m.content = redactPII(m.content).text.slice(0,8000);
      }
    }
    if(typeof req.body.context === 'string') req.body.context = redactPII(req.body.context).text.slice(0,4000);
    console.log(`[PII_REDACT] ${pii.join(',')} ip=${req.ip}`);
  }
  req.aiScore = score;
  next();
}

// Output guard (LLM02/05/07): strip system leakage + block XSS/SSRF/markdown exfil.
// Returns { text, blocked, reasons }. Blocked outputs become 502 (never stream raw).
export function sanitizeAIResponse(text){
  if(typeof text!=='string') return { text, blocked:false, reasons:[] };
  let out = text.slice(0,10000);
  const reasons=[];
  // System / reasoning leakage (LLM07)
  out = out
    .replace(/system\s+prompt/gi,'[filtered]')
    .replace(/internal\s+instructions/gi,'[filtered]')
    .replace(/<think>[\s\S]{0,5000}<\/think>/gi,'[reasoning_filtered]')
    .replace(/chain-of-thought/gi,'[filtered]');
  // PII / secrets in output (LLM02) — redact, don't block
  const r = redactPII(out);
  out = r.text;
  // Unsafe output (LLM05) — block
  for(const pat of OUTPUT_BLOCK){
    if(pat.test(out)){ reasons.push('unsafe_output:'+pat.source.slice(0,24)); }
  }
  if(MARKDOWN_EXFIL.test(out)) reasons.push('markdown_exfil');
  if(reasons.length) return { text:'', blocked:true, reasons };
  return { text: out, blocked:false, reasons, pii: r.pii };
}
