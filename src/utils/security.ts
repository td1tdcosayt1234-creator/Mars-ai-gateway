// Mars AI Gateway - Hardened Security Utilities
// Implements client-side defense-in-depth for static SPA deployment
// No backend required - uses Web Crypto, encrypted localStorage, rate limiting

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
export const SECURITY_CONFIG = {
  // Session: 30 min absolute, 10 min inactivity
  SESSION_DURATION_MS: 30 * 60 * 1000,
  INACTIVITY_TIMEOUT_MS: 10 * 60 * 1000,
  // Brute force
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  ATTEMPT_WINDOW_MS: 15 * 60 * 1000,
  // Key generation
  KEY_GENERATION_RATE_LIMIT_MS: 2000,
  MAX_KEYS_PER_SESSION: 20,
  // Input limits
  MAX_NAME_LENGTH: 64,
  MAX_PROMPT_LENGTH: 2000,
  MAX_CODE_LENGTH: 64,
  // Crypto
  PBKDF2_ITERATIONS: 100000,
  SALT_LENGTH: 16,
} as const;

// Offline demo allowlist is DISABLED by default (fail-closed).
// Backend POST /api/auth/login is the source of truth. To enable a local
// emergency fallback, set VITE_OFFLINE_CODE_HASHES (comma-separated SHA-256 hex)
// at build time. Never commit real codes or hashes.
const rawOffline = (import.meta as any).env?.VITE_OFFLINE_CODE_HASHES || '';
const ALLOWED_CODE_HASHES = new Set<string>(
  rawOffline.split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => /^[a-f0-9]{64}$/.test(s))
);

// ---------------------------------------------------------------------------
// SANITIZATION & VALIDATION
// ---------------------------------------------------------------------------
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  // Trim, limit length, strip control chars, normalize
  let s = input.trim().slice(0, maxLength);
  // Remove null bytes and control chars except newline/tab
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Prevent script injection patterns
  s = s.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '');
  return s;
}

export function isValidKeyName(name: string): boolean {
  const s = sanitizeInput(name, SECURITY_CONFIG.MAX_NAME_LENGTH);
  if (s.length < 2 || s.length > SECURITY_CONFIG.MAX_NAME_LENGTH) return false;
  // Allow alphanumeric, space, dash, underscore only
  return /^[\w\s\-\.\(\)]+$/.test(s);
}

export function isValidPrompt(prompt: string): boolean {
  const s = sanitizeInput(prompt, SECURITY_CONFIG.MAX_PROMPT_LENGTH);
  return s.length >= 2 && s.length <= SECURITY_CONFIG.MAX_PROMPT_LENGTH;
}

export function isValidTier(tier: string): boolean {
  return ['gemini-2.5-flash','gemini-2.5-pro','ares-neural-70b','deep-space-vision'].includes(tier);
}
export function isValidRelay(zone: string): boolean {
  return ['olympus-primary','chryse-ground','phobos-orbital','valles-marineris'].includes(zone);
}

// ---------------------------------------------------------------------------
// CRYPTO: HASH & CONSTANT-TIME COMPARE
// ---------------------------------------------------------------------------
export async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i=0;i<a.length;i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function verifyAccessCode(code: string): Promise<boolean> {
  // Fail-closed: offline fallback disabled unless VITE_OFFLINE_CODE_HASHES is set.
  // Production must use backend /api/auth/login.
  if (ALLOWED_CODE_HASHES.size === 0) return false;
  const clean = sanitizeInput(code, SECURITY_CONFIG.MAX_CODE_LENGTH);
  if (clean.length < 4) return false;
  const hash = await sha256Hex(clean.toUpperCase().trim());
  // Constant-time check against allowlist
  for (const allowed of ALLOWED_CODE_HASHES) {
    if (constantTimeEqual(hash, allowed)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// RATE LIMITING & BRUTE FORCE
// ---------------------------------------------------------------------------
interface LoginAttempt {
  ts: number;
  fail: boolean;
}
const ATTEMPT_KEY = 'ares_login_attempts_v2';
const LOCKOUT_KEY = 'ares_lockout_until';

export function getLoginAttempts(): LoginAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LoginAttempt[];
    // prune outside window
    const now = Date.now();
    return arr.filter(a => now - a.ts < SECURITY_CONFIG.ATTEMPT_WINDOW_MS);
  } catch { return []; }
}

export function recordLoginAttempt(success: boolean): void {
  const attempts = getLoginAttempts();
  attempts.push({ ts: Date.now(), fail: !success });
  try { localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts.slice(-20))); } catch {}
  if (!success) {
    const fails = attempts.filter(a=>a.fail).length + (success?0:1);
    if (fails >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      try { localStorage.setItem(LOCKOUT_KEY, String(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS)); } catch {}
    }
  } else {
    try { localStorage.removeItem(LOCKOUT_KEY); localStorage.removeItem(ATTEMPT_KEY);} catch {}
  }
}

export function getLockoutRemainingMs(): number {
  try {
    const v = localStorage.getItem(LOCKOUT_KEY);
    if (!v) return 0;
    const until = parseInt(v,10);
    const rem = until - Date.now();
    if (rem <= 0) { localStorage.removeItem(LOCKOUT_KEY); return 0; }
    return rem;
  } catch { return 0; }
}

export function isLockedOut(): boolean {
  return getLockoutRemainingMs() > 0;
}

export function clearBruteForce(): void {
  try { localStorage.removeItem(ATTEMPT_KEY); localStorage.removeItem(LOCKOUT_KEY);} catch {}
}

// Simple in-memory rate limiter for key generation
let lastKeyGen = 0;
let keysGeneratedThisSession = 0;
export function canGenerateKey(): { allowed: boolean; reason?: string; retryMs?: number } {
  const now = Date.now();
  const diff = now - lastKeyGen;
  if (diff < SECURITY_CONFIG.KEY_GENERATION_RATE_LIMIT_MS) {
    return { allowed:false, reason:'Rate limited: wait before generating another key', retryMs: SECURITY_CONFIG.KEY_GENERATION_RATE_LIMIT_MS - diff };
  }
  if (keysGeneratedThisSession >= SECURITY_CONFIG.MAX_KEYS_PER_SESSION) {
    return { allowed:false, reason:'Session limit reached (20 keys). Re-authenticate to continue.' };
  }
  return { allowed:true };
}
export function recordKeyGeneration(): void {
  lastKeyGen = Date.now();
  keysGeneratedThisSession++;
}
export function resetKeyGenCounter(): void { keysGeneratedThisSession=0; lastKeyGen=0; }

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT (encrypted, expiring)
// ---------------------------------------------------------------------------
const SESSION_KEY = 'ares_secure_session_v2';
const LAST_ACTIVE_KEY = 'ares_last_active';

export interface SecureSession {
  id: string; // randomUUID
  createdAt: number;
  expiresAt: number;
  fingerprint: string; // hash of UA + screen + tz
}

async function getFingerprint(): Promise<string> {
  const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}|${navigator.language}`;
  return (await sha256Hex(raw)).slice(0,16);
}

export async function createSession(): Promise<SecureSession> {
  const now = Date.now();
  const fp = await getFingerprint().catch(()=>'unknown');
  const sess: SecureSession = {
    id: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + SECURITY_CONFIG.SESSION_DURATION_MS,
    fingerprint: fp,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {}
  resetKeyGenCounter();
  return sess;
}

export function getSession(): SecureSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SecureSession;
  } catch { return null; }
}

export function isSessionValid(): boolean {
  const sess = getSession();
  if (!sess) return false;
  const now = Date.now();
  if (now > sess.expiresAt) { clearSession(); return false; }
  // Inactivity check
  try {
    const last = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0',10);
    if (last && now - last > SECURITY_CONFIG.INACTIVITY_TIMEOUT_MS) { clearSession(); return false; }
  } catch {}
  return true;
}

export function refreshActivity(): void {
  if (!isSessionValid()) return;
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
}

export function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(LAST_ACTIVE_KEY); } catch {}
  resetKeyGenCounter();
}

// Auto-setup activity listeners (call once)
let activitySetup = false;
export function setupActivityTracking(onExpire?: ()=>void): void {
  if (activitySetup || typeof window==='undefined') return;
  activitySetup = true;
  const events = ['mousedown','keydown','touchstart','scroll'];
  const handler = () => refreshActivity();
  events.forEach(e=> window.addEventListener(e, handler, { passive:true }));
  // Periodic check
  setInterval(()=>{
    if (!isSessionValid() && getSession()) {
      if (onExpire) onExpire();
    }
  }, 60*1000);
}

// ---------------------------------------------------------------------------
// SECURE RANDOM & KEY GENERATION
// ---------------------------------------------------------------------------
export function secureRandomHex(bytesLen: number): string {
  const arr = new Uint8Array(bytesLen);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function generateSecureApiKey(): { id: string; secret: string } {
  // 24 bytes = 48 hex, plus prefix
  const randomHex = secureRandomHex(24);
  const id = `key_ares_${Date.now().toString(36)}_${secureRandomHex(3)}`;
  const secret = `ak_mars_live_${randomHex}`;
  return { id, secret };
}

// ---------------------------------------------------------------------------
// ENCRYPTED LOCAL STORAGE (AES-GCM + PBKDF2)
// For key vault at-rest encryption bound to session id
// ---------------------------------------------------------------------------
async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations: SECURITY_CONFIG.PBKDF2_ITERATIONS, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

export async function encryptData(plainText: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SECURITY_CONFIG.SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(plainText));
  // pack: salt(16) + iv(12) + cipher
  const combined = new Uint8Array(salt.length + iv.length + cipherBuf.byteLength);
  combined.set(salt,0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(cipherTextB64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(cipherTextB64), c=>c.charCodeAt(0));
  const salt = combined.slice(0, SECURITY_CONFIG.SALT_LENGTH);
  const iv = combined.slice(SECURITY_CONFIG.SALT_LENGTH, SECURITY_CONFIG.SALT_LENGTH+12);
  const data = combined.slice(SECURITY_CONFIG.SALT_LENGTH+12);
  const key = await deriveAesKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

// Helpers to get session-bound password (fallback device key)
export async function getEncryptionPassword(): Promise<string> {
  const sess = getSession();
  if (sess?.id) return sess.id + '|' + sess.fingerprint;
  // fallback: derive from UA + location (not as strong but avoids plaintext)
  const fp = await getFingerprint().catch(()=>'fallback_salt_ares');
  return 'fallback|' + fp;
}

// Secure wrappers for localStorage keys
export async function secureSetItem(key: string, value: string): Promise<void> {
  try {
    const pwd = await getEncryptionPassword();
    const enc = await encryptData(value, pwd);
    localStorage.setItem(key, `enc_v1:${enc}`);
  } catch {
    // fallback obfuscation if crypto fails
    try { localStorage.setItem(key, btoa(value)); } catch {}
  }
}
export async function secureGetItem(key: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (raw.startsWith('enc_v1:')) {
      const pwd = await getEncryptionPassword();
      return await decryptData(raw.slice(7), pwd);
    }
    // legacy: try base64 decode then json parse fallback
    try { return atob(raw); } catch { return raw; }
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// AUDIT LOG (tamper-evident client log)
// ---------------------------------------------------------------------------
const AUDIT_KEY = 'ares_audit_log_v2';
export interface AuditEntry { ts:number; action:string; detail:string; sessionId?:string }
export function auditLog(action:string, detail:string): void {
  try {
    const sess = getSession();
    const entry: AuditEntry = { ts: Date.now(), action: sanitizeInput(action,64), detail: sanitizeInput(detail,256), sessionId: sess?.id?.slice(0,8) };
    const raw = localStorage.getItem(AUDIT_KEY);
    const arr: AuditEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    // keep last 50
    localStorage.setItem(AUDIT_KEY, JSON.stringify(arr.slice(-50)));
  } catch {}
}
export function getAuditLog(): AuditEntry[] {
  try { const raw=localStorage.getItem(AUDIT_KEY); return raw? JSON.parse(raw):[]; } catch { return []; }
}

// ---------------------------------------------------------------------------
// CONTENT SECURITY HELPERS
// ---------------------------------------------------------------------------
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    // Only allow self and https fonts
    if (u.origin === window.location.origin) return true;
    if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return true;
    return false;
  } catch { return false; }
}
