// crypto.js - Secure RNG + AES-GCM helpers for key vault at-rest encryption
import crypto from 'crypto';

export function secureRandomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateSecureKey() {
  const hex = secureRandomHex(24);
  const id = `key_ares_${Date.now().toString(36)}_${secureRandomHex(3)}`;
  return { id, secret: `ak_mars_live_${hex}` };
}

// AES-GCM encrypt/decrypt using PBKDF2 derived key (mirrors frontend)
export async function deriveKey(password, salt) {
  return new Promise((res, rej) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => err ? rej(err) : res(key));
  });
}
