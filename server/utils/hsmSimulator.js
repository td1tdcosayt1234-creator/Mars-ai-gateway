// hsmSimulator.js - Simulated HSM for master key (never export plaintext)
// FIPS-like: key gen, wrap/unwrap, rotation, audit
import crypto from 'crypto';

class HSM {
  constructor(){
    this.master = crypto.randomBytes(32);
    this.version = 1;
    this.audit = [];
    this.log('HSM_INIT', 'master v1 generated');
  }
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
    this.master=crypto.randomBytes(32);
    this.version++;
    this.log('ROTATE', `master v${this.version}`);
    return this.version;
  }
  getAudit(){ return this.audit.slice(-20); }
}
export const hsm = new HSM();
