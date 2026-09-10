// secureStore.js - Encrypted at-rest API key vault (AES-256-GCM + hash index)
// Never store plaintext secrets; hash for lookup, encrypt for storage
import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const MASTER = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex'); // 32 bytes hex
const masterKey = crypto.createHash('sha256').update(MASTER).digest(); // 32 bytes

function encrypt(text){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, masterKey, iv);
  const enc = Buffer.concat([cipher.update(text,'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + enc
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decrypt(b64){
  const buf = Buffer.from(b64,'base64');
  const iv = buf.subarray(0,12);
  const tag = buf.subarray(12,28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
function hashSecret(secret){
  return crypto.createHash('sha256').update(secret).digest('hex');
}

class SecureStore {
  constructor(){ this.map = new Map(); this.hashIndex = new Map(); }
  set(id, record){
    const secret = record.key;
    const h = hashSecret(secret);
    const encrypted = encrypt(secret);
    const copy = { ...record, key: encrypted, hash: h, plain:false };
    this.map.set(id, copy);
    this.hashIndex.set(h, id);
  }
  get(id){
    const rec = this.map.get(id);
    if(!rec) return null;
    // decrypt on read
    try{ return { ...rec, key: decrypt(rec.key), plain:true }; } catch{ return null; }
  }
  getByHash(hash){ const id=this.hashIndex.get(hash); return id ? this.get(id) : null; }
  getBySecret(secret){ return this.getByHash(hashSecret(secret)); }
  listMasked(){
    return [...this.map.values()].map(r=> ({
      id:r.id, name:r.name, tier:r.tier, relayZone:r.relayZone, status:r.status, createdAt:r.createdAt, rpmLimit:r.rpmLimit,
      keyMasked: 'ak_mars_live_••••' + r.hash.slice(0,4),
      hash: r.hash.slice(0,16) // for audit, not secret
    }));
  }
  revoke(id){
    const rec = this.map.get(id);
    if(!rec) return false;
    rec.status='revoked';
    this.map.set(id, rec);
    return true;
  }
  size(){ return this.map.size; }
}

export const secureStore = new SecureStore();
// Seed demo
secureStore.set('key_ares_01', { id:'key_ares_01', name:'Olympus Research Rover Agent', key:'ak_mars_live_9f82d7a6e14b09c2b3e81', tier:'gemini-2.5-flash', relayZone:'olympus-primary', status:'active', createdAt:'2026-08-22T08:14:00Z', rpmLimit:2500, monthlyQuota:50000000, tokensUsed:14829210 });
