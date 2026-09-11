// upstream.js - SSRF guard for server-side fetches (OAuth today, LLM upstream tomorrow)
// Every outbound URL must pass assertUpstream(): https only + host allowlist.
// Prevents user-controlled URLs from reaching metadata/private targets.
import { config } from '../config.js';

const BLOCKED = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /localhost/i, /169\.254\.169\.254/, /metadata\.google\.internal/i];

export function assertUpstream(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Upstream URL invalid'); }
  if (u.protocol !== 'https:') throw new Error('Upstream must be https');
  if (u.username || u.password) throw new Error('Upstream credentials forbidden');
  const host = u.hostname.toLowerCase();
  if (BLOCKED.some(p => p.test(host))) throw new Error('Upstream target blocked');
  if (!config.allowedUpstreams.has(host)) throw new Error(`Upstream host not allowlisted: ${host}`);
  return u.toString();
}

export async function safeFetch(raw, opts = {}) {
  const url = assertUpstream(raw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'manual' });
  } finally {
    clearTimeout(t);
  }
}
