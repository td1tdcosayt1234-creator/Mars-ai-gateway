// secureStore.js - Encrypted at-rest API key vault (AES-256-GCM + hash index)
// Never store plaintext secrets; hash for lookup, encrypt for storage.
// Persistence: encrypted blobs persisted to data/secureStore.json (0600) so
// single-instance restarts don't lose keys. Multi-instance must set REDIS_URL
// and share via Redis (see redisClient.js) + real DB in future.
import crypto from 'crypto';
import { config } from '../config.js';
import { loadJson, saveJson } from './durable.js';

const ALG = 'aes-256-gcm';
// PBKDF2-derived master (100k iterations) — never single SHA-256
const masterKey = crypto.pbkdf2Sync(config.masterKey, 'mars-secure-store-v1', 100000, 32, 'sha256');

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
  constructor(){
    this.map = new Map();
    this.hashIndex = new Map();
    // Restore encrypted blobs (never plaintext) from disk
    try {
      const saved = loadJson('secureStore.json', []);
      for (const r of saved) {
        if (r && r.id && r.key && r.hash) {
          this.map.set(r.id, r);
          this.hashIndex.set(r.hash, r.id);
        }
      }
      if (saved.length) console.log(`[STORE] restored ${saved.length} encrypted keys from disk`);
    } catch {}
  }
  persist() {
    try { saveJson('secureStore.json', [...this.map.values()]); } catch {}
  }
  set(id, record){
    const secret = record.key;
    // If record is already encrypted (restore path), don't re-encrypt
    if (record.plain === false && record.hash) {
      this.map.set(id, record);
      this.hashIndex.set(record.hash, id);
      this.persist();
      return;
    }
    const h = hashSecret(secret);
    const encrypted = encrypt(secret);
    const copy = { ...record, key: encrypted, hash: h, plain:false };
    this.map.set(id, copy);
    this.hashIndex.set(h, id);
    this.persist();
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
    this.persist();
    return true;
  }
  size(){ return this.map.size; }
}

export const secureStore = new SecureStore();
// No demo seeds with real-looking secrets. Keys are issued via POST /api/keys only.
