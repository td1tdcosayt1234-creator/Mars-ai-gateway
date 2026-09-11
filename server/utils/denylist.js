// denylist.js - revoked JWT (jti) store with expiry + family revocation
// Fixes: logout previously only cleared cookies — Bearer tokens stayed valid
// until expiry. Now logout/refresh denylist the jti; authenticate rejects them.
// Persisted to data/denylist.json (0600). Entries prune on read by exp.
import { loadSecureWithLegacy, saveSecure } from './durable.js';

const denied = new Map(); // jti -> exp (unix seconds), sealed at rest
try {
  const saved = loadSecureWithLegacy('denylist.json', []);
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of saved) {
    if (typeof jti === 'string' && typeof exp === 'number' && exp > now) denied.set(jti, exp);
  }
} catch {}
let persistT = null;
function persist() {
  if (persistT) return;
  persistT = setTimeout(() => {
    persistT = null;
    try { saveSecure('denylist.json', [...denied.entries()].slice(-2000)); } catch {}
  }, 3000);
}

export function deny(jti, exp) {
  if (!jti) return;
  const e = typeof exp === 'number' ? exp : Math.floor(Date.now() / 1000) + 30 * 60;
  denied.set(jti, e);
  persist();
}

export function isDenied(jti) {
  if (!jti) return false;
  const exp = denied.get(jti);
  if (exp === undefined) return false;
  if (exp * 1000 < Date.now()) { denied.delete(jti); persist(); return false; }
  return true;
}

// Revoke a whole family: caller passes all jtis it knows (e.g. from audit).
export function denyAll(jtis) {
  if (!Array.isArray(jtis)) return 0;
  let n = 0;
  for (const j of jtis) {
    if (typeof j === 'string' && j) { denied.set(j, Math.floor(Date.now() / 1000) + 30 * 60); n++; }
  }
  if (n) persist();
  return n;
}

export function denylistSize() { return denied.size; }
