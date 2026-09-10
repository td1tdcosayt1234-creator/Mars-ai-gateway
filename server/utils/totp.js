// totp.js - RFC6238 TOTP (6-digit, 30s, SHA1) without external deps - super security 2FA
import crypto from 'crypto';

function base32Decode(str){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits=''; let out=[];
  str=str.toUpperCase().replace(/=+$/,'');
  for(const c of str){
    const idx=alphabet.indexOf(c);
    if(idx===-1) continue;
    bits+=idx.toString(2).padStart(5,'0');
  }
  for(let i=0;i+8<=bits.length; i+=8){
    out.push(parseInt(bits.slice(i,i+8),2));
  }
  return Buffer.from(out);
}

export function generateSecret(len=20){
  // base32 secret for authenticator
  const bytes=crypto.randomBytes(len);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let out='';
  let bits=0, val=0;
  for(const b of bytes){
    val=(val<<8)|b; bits+=8;
    while(bits>=5){ out+=alphabet[(val>>>(bits-5))&31]; bits-=5; }
  }
  if(bits>0) out+=alphabet[(val<<(5-bits))&31];
  return out;
}

export function getTOTP(secret, window=0){
  const counter=Math.floor(Date.now()/30000)+window;
  const buf=Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key=base32Decode(secret);
  const hmac=crypto.createHmac('sha1', key).update(buf).digest();
  const offset=hmac[19] & 0x0f;
  const code=(hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6,'0');
}

export function verifyTOTP(secret, token, drift=1){
  if(!/^\d{6}$/.test(token)) return false;
  for(let i=-drift;i<=drift;i++){
    if(crypto.timingSafeEqual(Buffer.from(getTOTP(secret,i)), Buffer.from(token))) return true;
  }
  return false;
}

export function otpauthURL(secret, label='MarsGateway', issuer='Ares'){
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
