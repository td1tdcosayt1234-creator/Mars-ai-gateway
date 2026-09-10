// validation.js - Strict input validation, prototype pollution & NoSQL/XSS guard
// Defense against __proto__, $where, $ne, <script>, javascript:
const BLOCKED_KEYS = new Set(['__proto__','constructor','prototype']);
const NOSQL_PATTERN = /^\$|(\.\$)/;
const XSS_PATTERN = /<\s*script|javascript\s*:|onerror\s*=|onload\s*=/i;

export function guardPrototypePollution(req,res,next){
  const check = (obj)=>{
    if(!obj || typeof obj!=='object') return false;
    for(const k of Object.keys(obj)){
      if(BLOCKED_KEYS.has(k)) return true;
      if(NOSQL_PATTERN.test(k)) return true;
      if(typeof obj[k]==='object' && check(obj[k])) return true;
    }
    return false;
  };
  if(check(req.body) || check(req.query) || check(req.params)){
    return res.status(400).json({ error:'Blocked: prototype pollution / NoSQL injection detected' });
  }
  next();
}

export function xssGuard(req,res,next){
  const scan = (v)=>{
    if(typeof v==='string' && XSS_PATTERN.test(v)) return true;
    if(typeof v==='object' && v){
      for(const val of Object.values(v)) if(scan(val)) return true;
    }
    return false;
  };
  if(scan(req.body) || scan(req.query)){
    return res.status(400).json({ error:'Blocked: XSS pattern detected' });
  }
  next();
}

export function strictJsonLimit(req,res,next){
  // Already limit 10kb, plus depth check
  const depth = (obj,d=0)=>{
    if(d>10) return true;
    if(obj && typeof obj==='object'){
      for(const v of Object.values(obj)) if(depth(v,d+1)) return true;
    }
    return false;
  };
  if(req.body && depth(req.body)) return res.status(400).json({ error:'JSON too deep' });
  next();
}

// Central sanitizers
export function sanitizeString(str, max=1000){
  if(typeof str!=='string') return '';
  let s=str.trim().slice(0,max);
  s=s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'');
  s=s.replace(/javascript:/gi,'').replace(/data:/gi,'');
  return s;
}
export const validators = {
  tier: v => ['gemini-2.5-flash','gemini-2.5-pro','ares-neural-70b','deep-space-vision'].includes(v),
  zone: v => ['olympus-primary','chryse-ground','phobos-orbital','valles-marineris'].includes(v),
  name: v => typeof v==='string' && v.length>=2 && v.length<=64 && /^[\w\s\-\.\(\)]+$/.test(v),
};
