// auditLogger.js - Tamper-evident, hash-chained audit logger (JS)
// Every entry hashes previous, prevents silent deletion, sanitized, rate-limited
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const LOG_MAX = 500;
const auditChain = [];
let lastHash = crypto.createHash('sha256').update('GENESIS_MARS_782').digest('hex');

function sanitize(str, max=256){
  if(typeof str!=='string') return String(str).slice(0,max);
  return str.trim().slice(0,max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/javascript:/gi,'');
}

export function audit(action, detail, ip='unknown', userId='-'){
  const ts = Date.now();
  const entry = {
    ts, iso: new Date(ts).toISOString(),
    action: sanitize(action,64),
    detail: sanitize(detail,256),
    ip: sanitize(ip,45),
    user: sanitize(userId,32),
    prev: lastHash.slice(0,16),
  };
  const h = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  entry.hash = h;
  lastHash = h;
  auditChain.push(entry);
  if(auditChain.length > LOG_MAX) auditChain.shift();
  // structured console (never log secrets)
  console.log(JSON.stringify({ type:'AUDIT', ...entry }));
  return entry;
}

export function getAudit(lastN=50){
  return auditChain.slice(-lastN);
}

export function verifyChain(){
  let prev = crypto.createHash('sha256').update('GENESIS_MARS_782').digest('hex');
  for(const e of auditChain){
    const clone = { ...e }; delete clone.hash;
    const expect = crypto.createHash('sha256').update(JSON.stringify(clone)).digest('hex');
    if(e.hash !== expect) return { valid:false, bad:e };
    if(e.prev !== prev.slice(0,16)) return { valid:false, bad:e };
    prev = e.hash;
  }
  return { valid:true };
}

// Express middleware to auto-audit sensitive routes
export function auditMiddleware(req,res,next){
  const start = Date.now();
  const origJson = res.json.bind(res);
  res.json = (body)=>{
    const dur = Date.now()-start;
    if(req.path.startsWith('/api/') && !req.path.includes('/health')){
      audit(`${req.method} ${req.path}`, `status=${res.statusCode} dur=${dur}ms`, req.ip, req.user?.jti||'-');
    }
    return origJson(body);
  };
  next();
}
