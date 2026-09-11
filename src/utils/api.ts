/**
 * Mars Gateway — Secure Backend API Client
 * httpOnly-cookie first: JWT lives in Secure/HttpOnly/SameSite cookie set by backend.
 * In-memory Bearer is used only for non-browser API clients and is NEVER
 * persisted to localStorage (XSS would steal it).
 */
import { sanitizeInput } from './security';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

// In-memory only — cleared on reload, never localStorage
let memToken: string | null = null;

function getToken(): string | null {
  return memToken;
}
function setToken(t: string | null) {
  memToken = t;
}
function getCsrf(): string | null {
  try {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

async function secureFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(opts.headers as any || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const csrf = getCsrf();
  if (csrf && opts.method && ['POST','DELETE','PUT','PATCH'].includes(opts.method)) {
    headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: 'include' });
  if (res.status === 401) {
    // auto clear session
    setToken(null);
    // Don't throw for verify endpoint
    if (path !== '/auth/verify') {
      try { window.dispatchEvent(new CustomEvent('ares:unauthorized')); } catch {}
    }
  }
  return res;
}

export async function loginBackend(code: string): Promise<{ token:string; csrf:string }> {
  const clean = sanitizeInput(code, 64);
  if (!clean) throw new Error('Invalid code');
  const res = await secureFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ code: clean }),
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  // Keep in memory only for this tab — httpOnly cookie is the real session
  if (data.token) setToken(data.token);
  return data;
}

export async function verifyBackend(): Promise<boolean> {
  try {
    // Cookie-based verify works even with no in-memory token (reload-safe)
    const res = await secureFetch('/auth/verify');
    return res.ok;
  } catch { return false; }
}

export async function logoutBackend(): Promise<void> {
  try { await secureFetch('/auth/logout', { method: 'POST' }); } catch {}
  setToken(null);
}

export async function generateKeyBackend(tier: string, relayZone: string, name?: string) {
  const cleanName = sanitizeInput(name || '', 64);
  const res = await secureFetch('/keys', {
    method: 'POST',
    body: JSON.stringify({ tier, relayZone, name: cleanName }),
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Key generation failed');
  return data.key;
}

export async function listKeysBackend(): Promise<any[]> {
  const res = await secureFetch('/keys');
  if (!res.ok) throw new Error('Failed to list keys');
  const data = await res.json();
  return data.keys || [];
}

export async function revokeKeyBackend(id: string): Promise<void> {
  const clean = sanitizeInput(id, 128);
  const res = await secureFetch(`/keys/${encodeURIComponent(clean)}`, { method:'DELETE' });
  if (!res.ok) throw new Error('Revoke failed');
}

export function hasBackendToken(): boolean { return !!getToken(); }
