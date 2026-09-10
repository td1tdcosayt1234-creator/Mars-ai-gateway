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

## Hardened Security Features (2026-09)

- **Authentication**: SHA-256 hashed allowlist, constant-time compare, 5 attempts / 15 min lockout, 30 min session + 10 min inactivity timeout
- **Encryption at Rest**: AES-GCM 256 with PBKDF2 (100k iterations) for key vault; session-bound keys, never plaintext in localStorage
- **Secure RNG**: `crypto.getRandomValues` + `crypto.randomUUID` for all key generation (no Math.random)
- **Rate Limiting**: Key generation 2s cooldown, 20 keys/session max
- **Input Sanitization**: Strict allowlists, HTML escaping, length limits, XSS prevention on all inputs (name, prompt, CLI)
- **Headers**: CSP (default-src 'self'), HSTS preload, X-Frame-Options DENY, nosniff, COOP/COEP, Referrer-Policy, Permissions-Policy
- **Path Traversal Protection**: Realpath checks in Vite media plugin
- **Branch Protection**: Require PR, no force push, dismiss stale reviews
- **CI**: CodeQL, npm audit, secret scanning via GitHub Advanced Security

## Disclosure

Once fixed, we publish a GitHub Security Advisory and credit the reporter (if desired).

## Best Practices for Operators

- Rotate `GEMINI_API_KEY` via AI Studio Secrets, never commit `.env`
- Always deploy over HTTPS (HSTS enforced)
- Enable GitHub Dependabot alerts and keep dependencies pinned via `bun.lock`
