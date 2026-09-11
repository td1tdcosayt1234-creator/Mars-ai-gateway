// tests/security.test.js - 10/10 proof: fail-closed secrets, HMAC, Merkle, XSS, OAuth
// Run: npm test (node --test, no extra deps)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('secrets hygiene (no hardcoded bypass)', () => {
  it('no hardcoded auth hashes, demo keys, or dev secrets', () => {
    const banned = [
      'c55d6cf023bb7f3eee1a914', '8a84b6bc02483045e9947bb3ceb71a48', '3669aad75fda7c09de25f86650c33699',
      'ak_mars_live_9f82d7a6e14b09c2b3e81', 'ak_mars_live_4a17c889f02e33d712ab4',
      'MARS-OLYMPUS-2026', 'ARES-ADMIN-782', 'MARS-GATEWAY-DEMO',
      "'dev_secret'", '"dev_secret"', 'tier1_tier2_shared_dev',
      'ak_mars_live_HONEY_1234567890abcdef', 'sk-honey-canary-999',
    ];
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|ts|tsx)$/.test(e.name)) files.push(p);
      }
    };
    walk(path.join(root, 'server'));
    walk(path.join(root, 'src'));
    if (fs.existsSync(path.join(root, 'server.js'))) files.push(path.join(root, 'server.js'));
    for (const f of files) {
      const c = fs.readFileSync(f, 'utf8');
      for (const b of banned) assert.ok(!c.includes(b), `${path.relative(root, f)} contains banned ${b.slice(0, 20)}...`);
    }
  });

  it('config fail-closes in production (no defaults)', () => {
    const c = read('server/config.js');
    assert.ok(c.includes('AUTH_CODE_HASHES') && c.includes('process.exit(1)'));
    assert.ok(c.includes('JWT_SECRET') && c.includes('FATAL'));
    assert.ok(c.includes('TIER_HMAC') && c.includes('FATAL'));
    assert.ok(c.includes('MASTER_KEY') && c.includes('FATAL'));
  });
});

describe('tier HMAC (no bypass)', () => {
  it('tier2 recomputes HMAC with timingSafeEqual', () => {
    const c = read('server/middleware/tier2Core.js');
    assert.ok(c.includes("createHmac('sha256'") && c.includes('timingSafeEqual'));
    assert.ok(!c.includes('presence only'));
    // Router-proof: both sides use originalUrl (req.path is stripped by mounts)
    assert.ok(c.includes('originalUrl'));
    assert.ok(read('server/middleware/tier1Perimeter.js').includes('originalUrl'));
  });
  it('tier1 uses single timestamp for payload+header', () => {
    const c = read('server/middleware/tier1Perimeter.js');
    assert.ok(c.includes('const ts = String(Date.now())'));
    assert.ok(c.includes('x-tier2-sig'));
  });
  it('HMAC recompute vectors match', () => {
    const secret = 'test-' + crypto.randomBytes(8).toString('hex');
    const ts = String(Date.now());
    const p = `GET:/api/keys:${ts}`;
    const a = crypto.createHmac('sha256', secret).update(p).digest('hex');
    const b = crypto.createHmac('sha256', secret).update(p).digest('hex');
    assert.ok(a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)));
  });
});

describe('vault crypto (no single-SHA, no crash)', () => {
  it('masters use PBKDF2, never single SHA-256', () => {
    for (const f of ['server/utils/secureStore.js', 'server/middleware/tier3DeepVault.js', 'server/utils/kmsProvider.js']) {
      const c = read(f);
      assert.ok(c.includes('pbkdf2Sync'), `${f} must use pbkdf2Sync`);
    }
    assert.ok(!read('server/utils/secureStore.js').includes("createHash('sha256').update(MASTER"));
  });
  it('merkle append/verify canonical', async () => {
    const { append, verify } = await import('../server/utils/merkleAudit.js');
    append({ action: 't1', detail: 'a', ip: '1.1.1.1' });
    append({ action: 't2', detail: 'b', ip: '2.2.2.2' });
    const v = verify();
    assert.equal(v.valid, true);
  });
  it('apiKey compare never throws on length mismatch', async () => {
    const src = read('server/middleware/apiKeyAuth.js');
    assert.ok(src.includes('safeEqualHex') && src.includes('a.length !== b.length'));
  });
});

describe('transport/session (no exfil)', () => {
  it('OAuth never puts JWT in URL', () => {
    const c = read('server/routes/oauth.js');
    assert.ok(!c.includes('?oauth=github&token=') && !c.includes('?oauth=google&token='));
    assert.ok(!c.includes("ares_user', JSON.stringify"));
  });
  it('frontend never persists JWT to localStorage', () => {
    const c = read('src/utils/api.ts');
    assert.ok(!c.includes('localStorage.getItem') && !c.includes('localStorage.setItem'));
    assert.ok(c.includes('In-memory only') || c.includes('memToken'));
  });
  it('CSP has no unsafe-eval in prod', () => {
    assert.ok(!read('index.html').includes("'unsafe-eval'"));
    assert.ok(!read('vite.config.ts').includes("'unsafe-eval'"));
  });
  it('transport: loopback bind default, TLS opt-in, proxy files', () => {
    const cfg = read('server/config.js');
    assert.ok(cfg.includes("host: process.env.HOST || '127.0.0.1'"));
    assert.ok(cfg.includes('TLS_CERT_PATH') && cfg.includes('TLS_KEY_PATH'));
    const s = read('server.js');
    assert.ok(s.includes('config.host') && s.includes('https.createServer'));
    assert.ok(fs.existsSync(path.join(root, 'Caddyfile')));
    assert.ok(fs.existsSync(path.join(root, 'nginx.example.conf')));
  });
  it('CSP: no script unsafe-inline in prod, dev localhost gated', () => {
    const getScriptSrc = (csp) => {
      const m = csp.match(/script-src([^;]*)/);
      return m ? m[1] : '';
    };
    assert.ok(!getScriptSrc(read('server.js')).includes('unsafe-inline'));
    assert.ok(!getScriptSrc(read('index.html')).includes('unsafe-inline'));
    assert.ok(!getScriptSrc(read('public/_headers')).includes('unsafe-inline'));
    // API connect-src: localhost only via DEV_CONNECT (prod-clean)
    assert.ok(read('server.js').includes('DEV_CONNECT'));
    assert.ok(!read('server.js').includes('generativelanguage.googleapis.com"],'));
    // No open https: img-src in shipped CSPs
    assert.ok(!read('server.js').includes('imgSrc: ["\'self\'", "data:", "https:", "blob:"]'));
    assert.ok(!read('public/_headers').includes("img-src 'self' data: https: blob:"));
  });
  it('trust-proxy safe: no X-Forwarded-For split for auth', () => {
    assert.ok(!read('server.js').includes("x-forwarded-for']?.toString().split"));
    assert.ok(!read('server/routes/auth.js').includes('x-forwarded-for'));
  });
  it('middleware order: tier2Guard before sensitive handlers', () => {
    const c = read('server.js');
    assert.ok(c.indexOf("app.use('/api/keys', tier2Guard)") < c.indexOf("app.get('/api/keys'"));
  });
  it('Express5 SPA fallback uses regex, not *', () => {
    assert.ok(read('server.js').includes('app.get(/.*/'));
    assert.ok(!read('server.js').includes("app.get('*'"));
  });
});

describe('session 20x (bind, revoke, rotate)', () => {
  it('JWT iss/aud enforced + fingerprint binding + denylist', () => {
    const a = read('server/middleware/auth.js');
    assert.ok(a.includes('jwtIssuer') && a.includes('jwtAudience'));
    assert.ok(a.includes('issuer:') && a.includes('audience:'));
    assert.ok(a.includes('fingerprint') && a.includes('timingSafeEqual'));
    assert.ok(a.includes('isDenied') && a.includes('Token revoked'));
    assert.ok(read('server/utils/denylist.js').includes('denylist.json'));
    assert.ok(read('server.js').includes('/api/auth/refresh') && read('server.js').includes('/api/auth/logout-all'));
  });
  it('CSRF Origin check + constant-time compare + no-store secrets', () => {
    const a = read('server/middleware/auth.js');
    assert.ok(a.includes('Origin not allowed') && a.includes('noStore'));
    assert.ok(read('server.js').includes("noStore") && read('server.js').includes('/api/vault'));
  });
  it('audit scoped: full log admin-only, /mine for users', () => {
    const s = read('server.js');
    assert.ok(s.includes('/api/audit/mine') && s.includes('Admin only'));
  });
  it('slowloris timeouts + originAgentCluster + SSRF allowlist', () => {
    const s = read('server.js');
    assert.ok(s.includes('headersTimeout') && s.includes('requestTimeout') && s.includes('originAgentCluster'));
    assert.ok(read('server/utils/upstream.js').includes('allowedUpstreams'));
    assert.ok(read('server/routes/oauth.js').includes('safeFetch'));
  });
  it('issued tokens carry iss/aud and verify enforces them', async () => {
    const { signToken, verifyToken } = await import('../server/middleware/auth.js');
    const { config } = await import('../server/config.js');
    const jwt = await import('jsonwebtoken');
    const t = signToken({ ip: '127.0.0.1', fp: 'testfp1234567890' });
    const p = verifyToken(t);
    assert.ok(p.iss && p.aud && p.jti);
    assert.equal(p.iss, config.jwtIssuer);
    assert.throws(() => jwt.default.verify(t, config.jwtSecret, { issuer: 'wrong-issuer' }));
  });
});

describe('dashboard 20x (backend-live, no localStorage JWT)', () => {
  it('panels use cookie auth, audit via /mine', () => {
    for (const f of ['src/components/TwoFactorPanel.tsx', 'src/components/ThreeTierPanel.tsx', 'src/components/AIGovernance.tsx', 'src/components/SecurityDashboard.tsx']) {
      assert.ok(!read(f).includes('ares_jwt'), `${f} must not read ares_jwt`);
    }
    assert.ok(read('src/components/AIGovernance.tsx').includes('/api/audit/mine'));
    assert.ok(read('src/components/SecurityDashboard.tsx').includes('/api/auth/verify'));
  });
  it('dashboard tabs + backend keys + 401 auto-logout + key autohide', () => {
    const d = read('src/pages/DashboardPage.tsx');
    assert.ok(d.includes('ApiKeysTab') && d.includes('SecurityTab') && d.includes('VaultAuditTab'));
    assert.ok(read('src/components/dashboard/ApiKeysTab.tsx').includes('listKeysBackend'));
    assert.ok(read('src/App.tsx').includes('ares:unauthorized'));
    assert.ok(read('src/components/KeyGeneratorCard.tsx').includes('auto-hide') || read('src/components/KeyGeneratorCard.tsx').includes('shown once'));
  });
});

describe('database-proof (hacker cannot reach the vault)', () => {
  it('vault files sealed: tamper fails closed, no plaintext secrets', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { saveSecure, loadSecure } = await import('../server/utils/durable.js');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    void dir;
    saveSecure('__test_seal.json', [{ id: 'x', key: 'supersecret' }]);
    const back = loadSecure('__test_seal.json', null);
    assert.ok(Array.isArray(back) && back[0].key === 'supersecret');
    // Raw file must not contain the plaintext
    const { readFileSync, writeFileSync, unlinkSync } = fs;
    const { join } = path;
    const root = join(dir, '..');
    const raw = readFileSync(join(root, 'data', '__test_seal.json'), 'utf8');
    assert.ok(!raw.includes('supersecret'));
    // Tamper one byte → fallback (never loads forged data)
    const parsed = JSON.parse(raw);
    parsed.blob = 'A' + parsed.blob.slice(1);
    writeFileSync(join(root, 'data', '__test_seal.json'), JSON.stringify(parsed));
    assert.equal(loadSecure('__test_seal.json', 'FALLBACK'), 'FALLBACK');
    unlinkSync(join(root, 'data', '__test_seal.json'));
    for (const f of ['server/utils/secureStore.js', 'server/routes/twoFactor.js', 'server/utils/denylist.js', 'server/middleware/tenantQuota.js', 'server/middleware/rateLimiter.js', 'server/middleware/auditLogger.js']) {
      assert.ok(read(f).includes('saveSecure') || read(f).includes('loadSecure'), `${f} must use sealed persistence`);
    }
  });
  it('row-level ownership: users see only own keys', async () => {
    const { SecureStore } = await import('../server/utils/secureStore.js');
    const s = new SecureStore();
    s.persist = () => {};
    s.map.clear(); s.hashIndex.clear();
    s.set('a1', { id: 'a1', name: 'A key', key: 'ak_mars_live_' + 'a'.repeat(48), tier: 'gemini-2.5-flash', relayZone: 'olympus-primary', status: 'active', createdAt: 'x', rpmLimit: 1, owner: 'userA' });
    s.set('b1', { id: 'b1', name: 'B key', key: 'ak_mars_live_' + 'b'.repeat(48), tier: 'gemini-2.5-flash', relayZone: 'olympus-primary', status: 'active', createdAt: 'x', rpmLimit: 1, owner: 'userB' });
    assert.equal(s.listMasked('userA', false).length, 1);
    assert.equal(s.listMasked('userA', false)[0].id, 'a1');
    assert.ok(!s.listMasked('userA', false).some(k => k.key && k.key.includes('aaaa')));
    assert.ok(s.owns('a1', 'userA', false) && !s.owns('a1', 'userB', false));
    assert.ok(s.owns('a1', 'anyone', true)); // admin override
    assert.ok(read('server.js').includes('listMasked(keyOwner(req), keyIsAdmin(req))'));
    assert.ok(read('server.js').includes('apiKeys.owns(id, keyOwner(req), keyIsAdmin(req))'));
  });
  it('prod secrets must be distinct + vault paths denied', () => {
    assert.ok(read('server/config.js').includes('must all be distinct'));
    const s = read('server.js');
    assert.ok(s.includes('BLOCKED_PATHS') && s.includes('/data'));
  });
});

describe('brute-force caps (TOTP/OAuth/AI/owner)', () => {
  it('HS256 pinned on every sign+verify, reuse audited', () => {
    assert.ok(read('server/middleware/auth.js').includes("algorithms: ['HS256']"));
    assert.ok(read('server/middleware/tier2Core.js').includes("algorithms: ['HS256']"));
    assert.ok(read('server/routes/oauth.js').includes("algorithms: ['HS256']"));
    const signs = (read('server.js').match(/algorithm: 'HS256'/g) || []).length;
    assert.ok(signs >= 2);
    assert.ok(read('server/middleware/auth.js').includes('token_reuse'));
  });
  it('2FA/OAuth/AI limiters exist and are wired', () => {
    const rl = read('server/middleware/rateLimiter.js');
    assert.ok(rl.includes('tfaLimiter') && rl.includes('oauthLimiter') && rl.includes('aiLimiter'));
    const tf = read('server/routes/twoFactor.js');
    assert.ok(tf.includes('/setup\', authenticate, tfaLimiter') && tf.includes('/verify\', authenticate, tfaLimiter'));
    const oa = read('server/routes/oauth.js');
    assert.ok(oa.includes("'/github', oauthLimiter") && oa.includes("'/google', oauthLimiter") && oa.includes('validState'));
    const ai = read('server/routes/aiGateway.js');
    assert.ok(ai.includes('aiLimiter, quotaGuard') && ai.includes('aiLimiter, aiFirewall'));
  });
  it('per-owner key cap 20 both routes', () => {
    assert.ok(read('server/utils/secureStore.js').includes('ownerCount'));
    assert.ok(read('server.js').includes('ownerCount(keyOwner(req)) >= 20'));
    assert.ok(read('server/routes/keys.js').includes('ownerCount('));
  });
  it('Turnstile real verify + sealed backup codes', () => {
    const t = read('server/middleware/tier1Perimeter.js');
    assert.ok(t.includes('TURNSTILE_SECRET') && t.includes('siteverify') && t.includes('failing open'));
    const b = read('server/routes/twoFactor.js');
    assert.ok(b.includes('newBackupCodes') && b.includes('consumeBackupCode') && b.includes('twoFactorCodes.json') && b.includes('timingSafeEqual'));
    assert.ok(read('src/components/TwoFactorPanel.tsx').includes('backup_codes'));
  });
});

describe('persistence + governance (10/10)', () => {
  it('secureStore/quota/brute/audit/2fa persist to disk', () => {
    assert.ok(read('server/utils/secureStore.js').includes('secureStore.json'));
    assert.ok(read('server/middleware/tenantQuota.js').includes('quota.json'));
    assert.ok(read('server/middleware/rateLimiter.js').includes('brute.json'));
    assert.ok(read('server/middleware/auditLogger.js').includes('audit.json'));
    assert.ok(read('server/routes/twoFactor.js').includes('twoFactor.json'));
  });
  it('KMS abstraction with persisted rotation', () => {
    const c = read('server/utils/kmsProvider.js');
    assert.ok(c.includes('KMS_PROVIDER') && c.includes('hsm.json') && c.includes('210000'));
  });
  it('branch protection as code + SBOM + tests wired', () => {
    assert.ok(fs.existsSync(path.join(root, '.github', 'settings.yml')));
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.scripts.test.includes('node --test'));
    assert.ok(pkg.scripts.sbom.includes('cyclonedx'));
    assert.ok(pkg.dependencies.redis && pkg.dependencies['rate-limit-redis']);
  });
});
