# 3-Tier Hack-Proof Architecture — Mars AI Gateway (10-min Build)

**Goal:** Even if one tier falls, next tier blocks. Hack requires breaking all 3 within 10m window.

## Tier1 — Perimeter (Edge WAF)
- Location: `server/middleware/tier1Perimeter.js`
- Flood 300/min →5m block, bot UA HeadlessChrome/sqlmap 403, WAF SQLi/XSS/PathTraversal/PromptInjection, CAPTCHA after 5 fails, internal HMAC `TIER_HMAC` to Tier2.
- Headers: `X-Tier1: pass`

## Tier2 — Vault (Application Zero-Trust)
- Location: `server/middleware/tier2Core.js` + `superSecurity.js`
- Verifies Tier1 HMAC + JWT `httpOnly secure sameSite` + CSRF double-submit + 2FA TOTP 6-digit 30s (`server/utils/totp.js`)
- RBAC tier→model, quota `tenantQuota.js`, AI firewall `aiFirewall.js` score≥50 block, PII redact.
- `X-Tier2: vault-pass` + 2FA mark 10m

## Tier3 — Deep Vault (Data Plane)
- Location: `server/middleware/tier3DeepVault.js` + `hsmSimulator.js` + `merkleAudit.js`
- Requires Tier1+Tier2, honeypot canary (see `HONEY_TOKENS` env) →418 trap + IP block
- Vault freshness 10m re-auth, enclave attestation `x-tier2-sig`
- Envelope encryption: dataKey 32B per record → master wrap AES-256-GCM (`MASTER_KEY` env PBKDF2-derived, HSM simulated `hsmSimulator.js` rotation v1→vN), Merkle root hash-chained `TIER3_GENESIS...`
- Immutable audit `merkleAudit.js` append-only, root verifiable, `GET /api/vault/status` returns leaves/root

## Build 10-min Hardening
- `npm install` 2m, `vite build` 1m, Render deploy 3m, HSM init + key rotation + WAF test 4m = 10m
- All via GitHub, branch protection 1 review, secret scanning, CodeQL, Scorecard, Dependabot.

## Hack Scenarios Blocked
1. **Bypass Tier1 direct to Tier2:** fails `x-tier1-sig` HMAC recompute →403 Tier2
2. **Stolen JWT:** Tier2 2FA 10m window + Tier3 10m freshness → re-auth needed, canary trap
3. **Prompt injection:** Tier1 WAF + Tier2 AI firewall dual
4. **DB leak:** Tier3 envelope → master via PBKDF2 from `MASTER_KEY` env (simulated HSM), dataKey per record

Test (canary value from `HONEY_TOKENS` env, never committed):
- `curl -H "x-api-key: <HONEY_TOKEN>" /api/keys` →418
- `POST /api/v1/chat/completions` with `ignore previous instructions` →403 Tier1 WAF
- `POST /api/keys` without `x-2fa-token` after 10m →403 need2FA
