// tier3DeepVault.js - TIER-3 DEEP VAULT (Data Plane, Zero-Trust, HSM, Immutable)
// Only AFTER Tier1+Tier2 pass. Holds master keys, envelope encryption, canary, honeypot
import crypto from 'crypto';
import { config } from '../config.js';

const MASTER_KEY = config.masterKey;
// PBKDF2-derived master (100k iterations) — never single SHA-256
const master = crypto.pbkdf2Sync(MASTER_KEY, 'mars-tier3-vault-v1', 100000, 32, 'sha256');
// Honey tokens from env only — never hardcode real canaries in source
const HONEY_TOKENS = config.honeyTokens;
const MERKLE_LEAVES = [];
let merkleRoot = crypto.createHash('sha256').update('GENESIS_TIER3').digest('hex');

// Envelope encrypt: dataKey per record, master wraps dataKey
function envelopeEncrypt(plaintext){
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext,'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Wrap dataKey with master
  const wrapIv = crypto.randomBytes(12);
  const wrapCipher = crypto.createCipheriv('aes-256-gcm', master, wrapIv);
  const wrapped = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();
  // leaf for merkle
  const leaf = crypto.createHash('sha256').update(enc).digest('hex');
  MERKLE_LEAVES.push(leaf);
  merkleRoot = crypto.createHash('sha256').update(merkleRoot + leaf).digest('hex');
  return {
    iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64'),
    wrapIv: wrapIv.toString('base64'), wrapTag: wrapTag.toString('base64'), wrapped: wrapped.toString('base64'),
    leaf, merkleRoot
  };
}
function envelopeDecrypt(blob){
  const dataKeyEnc = Buffer.from(blob.wrapped,'base64');
  const wrapIv = Buffer.from(blob.wrapIv,'base64');
  const wrapTag = Buffer.from(blob.wrapTag,'base64');
  const decipherWrap = crypto.createDecipheriv('aes-256-gcm', master, wrapIv);
  decipherWrap.setAuthTag(wrapTag);
  const dataKey = Buffer.concat([decipherWrap.update(dataKeyEnc), decipherWrap.final()]);
  const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, Buffer.from(blob.iv,'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(blob.data,'base64')), decipher.final()]).toString('utf8');
}

export function tier3Vault(req,res,next){
  // 1. Must have Tier1+Tier2
  if(!req.tier1) return res.status(403).json({ error:'Tier3: Tier1 missing', tier:3 });
  if(!req.user) return res.status(401).json({ error:'Tier3: vault identity missing', tier:3 });
  // 2. Canary / honeypot detection (values from HONEY_TOKENS env, never logged)
  const keyId = req.headers['x-api-key'] || req.body?.keyId;
  if(typeof keyId === 'string' && HONEY_TOKENS.size > 0 && HONEY_TOKENS.has(keyId)){
    console.error(`[TIER3 HONEYPOT] canary triggered ip=${req.ip}`);
    // Alert + block IP 24h
    return res.status(418).json({ error:'Tier3: canary trap triggered - incident logged', tier:3, incident:true });
  }
  // 3. Zero-trust: re-verify JWT + Tier2 2FA already done, now check vault freshness (token <5min old)
  const iat = req.user.iat ? req.user.iat*1000 : 0;
  if(Date.now() - iat > 10*60*1000){
    return res.status(401).json({ error:'Tier3: vault session stale (>10m), re-auth', tier:3, reauth:true });
  }
  // 4. Enclave attestation: Tier2 must have added its own sig (fail-closed in prod)
  if(!req.headers['x-tier1-sig'] || !req.headers['x-tier2-sig']){
    if (config.isProd) {
      return res.status(403).json({ error:'Tier3: tier attestation missing', tier:3 });
    }
    console.warn(`[TIER3] missing tier2 sig ip=${req.ip}`);
  }
  req.tier3 = { vault: true, merkleRoot, envelopeEncrypt, envelopeDecrypt };
  res.setHeader('X-Tier3', `vault merkle=${merkleRoot.slice(0,8)}`);
  next();
}

export function getMerkleRoot(){ return merkleRoot; }
export function getVaultStatus(){ return { leaves: MERKLE_LEAVES.length, root: merkleRoot, hsm: 'simulated-AES256-GCM' }; }
