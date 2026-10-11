# Vani AI — Security Policy & Controls

## Supported Versions

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.x     | :white_check_mark: | Active production |

---

## Reporting a Vulnerability

Security is a core pillar of Vani AI. If you identify a security weakness, bug, or vulnerability:

1. **Do not disclose publicly via GitHub issues or discussions.**
2. Send an email to `security@vani.ai` or create a private GitHub Security Advisory.
3. Provide step-by-step reproduction instructions and endpoint traces.
4. Reports are acknowledged within 24 hours and critical fixes deployed within 72 hours.

---

## Security Architecture & Defense-in-Depth

### 1. Authentication & Route Hardening
- **Production Guard**: Passwordless developer login (`/api/auth/dev-login`) is strictly disabled in `NODE_ENV=production`.
- **Session Protection**: Sessions use `httpOnly: true`, `sameSite: 'lax'`, and dynamic `secure: req.secure || process.env.NODE_ENV === 'production'`.
- **Session Fixation Prevention**: Session IDs are automatically regenerated upon login and registration.
- **Credit Abuse Prevention**: Guest users are bound to ephemeral database records (`expiresAt: 24h`) and restricted to max 5 actions, strictly throttled to prevent resource exhaustion.

### 2. Authorization & IDOR Defenses
- **Unified Ownership Verification**: All project, task, document, and session endpoints explicitly query `where: { id, userId: req.user.id }`.
- **Information Leak Prevention**: Non-existent resources and resources belonging to other users return identical HTTP `404 Not Found` responses to prevent IDOR enumeration attacks.

### 3. Data Protection & Secrets
- **AES-256-GCM Encryption**: Third-party API keys (OpenAI, Gemini, Sarvam, TinyFish) saved in user settings are encrypted using AES-256-GCM.
- **Key Versioning**: Encrypted payloads use version prefixes (`v1:<iv>:<authTag>:<cipherText>`) to enable transparent key rotation.
- **Log Redaction**: Pino structured logging automatically redacts passwords, tokens, API keys, and authorization headers.

### 4. Injection & External Content Defense
- **Prompt Injection Containment**: All external web content scraped or retrieved via TinyFish is wrapped inside `<UNTRUSTED_WEB_RESEARCH_DATA>` tags with strict instruction isolation.
- **Content Security Policy (CSP)**: Strict helmet CSP headers disable inline scripts and enforce specific connect/script/style source allowances.
