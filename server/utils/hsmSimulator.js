// hsmSimulator.js - KMS-backed master (never export plaintext)
// Production: set KMS_PROVIDER=aws-kms|gcp-kms with real HSM. Default local uses
// kmsProvider (PBKDF2 210k) with persisted version (data/hsm.json).
import crypto from 'crypto';
import { kms } from './kmsProvider.js';

class HSM {
  constructor(){
    this.version = kms.version;
    this.audit = [];
    this.log('HSM_INIT', `provider=${kms.provider} v${this.version} PBKDF2(${kms.iterations})`);
  }
  get master() { return kms.master(); }
  log(action, detail){
    this.audit.push({ ts: Date.now(), action, detail, v:this.version });
    if(this.audit.length>100) this.audit.shift();
  }
  // Wrap dataKey with master (envelope)
  wrap(dataKey){
    const iv=crypto.randomBytes(12);
    const c=crypto.createCipheriv('aes-256-gcm', this.master, iv);
    const enc=Buffer.concat([c.update(dataKey), c.final()]);
    const tag=c.getAuthTag();
    this.log('WRAP', `dataKey ${dataKey.length}B`);
    return { iv:iv.toString('base64'), tag:tag.toString('base64'), wrapped:enc.toString('base64'), v:this.version };
  }
  unwrap(blob){
    const decipher=crypto.createDecipheriv('aes-256-gcm', this.master, Buffer.from(blob.iv,'base64'));
    decipher.setAuthTag(Buffer.from(blob.tag,'base64'));
    const out=Buffer.concat([decipher.update(Buffer.from(blob.wrapped,'base64')), decipher.final()]);
    this.log('UNWRAP', `v${blob.v}`);
    return out;
  }
  rotate(){
    // Local rotation bumps persisted version + re-derives master.
    // Production KMS: rotate in AWS/GCP KMS + re-wrap data keys (see kmsProvider).
    const v = kms.rotate();
    this.version = v;
    this.log('ROTATE', `master v${this.version} provider=${kms.provider}`);
    return this.version;
  }
  getAudit(){ return this.audit.slice(-20); }
}
export const hsm = new HSM();
