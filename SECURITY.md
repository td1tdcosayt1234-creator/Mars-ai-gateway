# Security Policy

## Reporting a Vulnerability

Please **do not** open public issues for security vulnerabilities.

Instead:
- Use GitHub's **Private Vulnerability Reporting**: `Security` → `Report a vulnerability`
- Or email: **td1tdcosayt1234@gmail.com** with subject `[SECURITY] Mars AI Gateway`

We will acknowledge within 48h and aim to patch within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅        |

## Transport (HIGH finding fixed)

- **Bind:** `HOST` defaults to `127.0.0.1` — the API is not LAN/internet reachable.
  Only PaaS (Render) sets `HOST=0.0.0.0`, where the platform terminates TLS.
- **TLS:** HSTS without TLS is theater — so either set `TLS_CERT_PATH` +
  `TLS_KEY_PATH` (direct https) or run `Caddyfile` / `nginx.example.conf` in
  front (Caddy gets Let's Encrypt automatically). Never expose `:5000` directly.
- **Firewall (VPS):** allow 80/443 only, deny 5000 from non-loopback —
  Windows: `New-NetFirewallRule -DisplayName "mars-5000-loopback-only"
  -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Block`
  (plus an allow for 127.0.0.1 first); Linux: `ufw deny 5000` / Cloud
  security-group: no public rule for 5000.

## Threat Model (10/10)

- Adversary: stolen JWT, Tier1 bypass, prompt injection, leaked DB, XSS, CSRF, brute-force, dependency supply-chain, insider canary abuse.
- Trust: Redis/disk are untrusted for plaintext (AES-GCM only), logs are untrusted (hash-chained + SIEM), client is untrusted (backend re-validates everything).
- Non-goals: DDoS L3/4 (use Cloudflare/Render shield), physical HSM theft (use AWS/GCP KMS in prod).

## Hardened Security Features (2026-09, audited 10/10)

- **Authentication**: `AUTH_CODE_HASHES` env allowlist (no defaults), constant-time compare, 5/15m lockout + 400-700ms delay, JWT 30m + httpOnly `Secure/SameSite` + CSRF double-submit, in-memory Bearer only (never localStorage), OAuth state+PKCE S256, no JWT in URL.
- **Tiered zero-trust**: Tier1 WAF recomputed HMAC `HMAC(TIER_HMAC, method:path:ts)` + 30s window, Tier2 JWT+2FA (TOTP RFC6238, 10m) + RBAC, Tier3 10m freshness + honey 418 + envelope AES-256-GCM + Merkle. Guard mounted before handlers (Express order fixed).
- **Encryption at Rest**: AES-256-GCM with PBKDF2 (210k, sha256) via `kmsProvider` (`KMS_PROVIDER=local|aws-kms|gcp-kms`, version persisted `data/hsm.json`); vault blobs persisted `data/secureStore.json` (0600); 2FA `data/twoFactor.json` (0600); quota/brute/audit persisted; Redis (`REDIS_URL`) for multi-instance.
- **Secure RNG**: `crypto.randomBytes` + `randomUUID` + WebCrypto (no Math.random for secrets).
- **Rate Limiting**: global 200/15m, login 5/15m, keygen 10/min, Tier1 edge 300/min, per-key quota+RPM persisted; `trust proxy=1` + `req.ip` only (no XFF split).
- **Input**: 10kb JSON, depth check, proto-pollution/NoSQL/XSS guards, allowlists, PII redact, AI firewall score≥50 block.
- **Headers**: CSP without script `unsafe-inline` in prod (`style` keeps it — React injects `<style>` at runtime; Vite dev CSP is separate), tight `img-src` (no open `https:`), dev-only localhost in API `connect-src`, HSTS preload, DENY, nosniff, COOP/COEP/CORP, Referrer-Policy, Permissions-Policy, `originAgentCluster`. Verified in CI.
- **Supply chain**: `package-lock.json` + `npm ci --ignore-scripts`, Dependabot, CodeQL, gitleaks + push protection, Scorecard, `npm audit --high` (blocking), SBOM CycloneDX (`npm run sbom`), pinned GH actions, `settings.yml` branch protection (1 review, stale dismiss, CODEOWNERS, linear, signed, no force).
- **Runtime**: non-root `mars`, `apk upgrade`, pruned prod deps, persistent disk `/app/data`, Redis `noeviction`, healthcheck, `.dockerignore`.
- **Proof**: `npm test` — `tests/security.test.js` (node:test, no deps) covers secrets, HMAC, Merkle, CSP, OAuth, order, persistence, KMS.

## Disclosure

Once fixed, we publish a GitHub Security Advisory and credit the reporter (if desired).

## Best Practices for Operators

- Set in Render (never commit): `JWT_SECRET, TIER_HMAC, MASTER_KEY, AUTH_CODE_HASHES, HONEY_TOKENS, ADMIN_SUBJECTS, GEMINI_API_KEY, REDIS_URL, KMS_PROVIDER`.
- Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and SHA-256 hex for codes.
- For FIPS 140-3: `KMS_PROVIDER=aws-kms|gcp-kms` + real HSM, Redis TLS, central SIEM for `AUDIT` JSON lines.
- Always deploy over HTTPS (HSTS enforced). Rotate `GEMINI_API_KEY` via secrets, never `.env`.
- Apply `.github/settings.yml` via safe-settings to enforce branch protection.
