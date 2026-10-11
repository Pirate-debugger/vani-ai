# Vani AI — Known Limitations & Operational Constraints
**Date:** October 11, 2026  
**Status:** Living Documentation  

This document enumerates the verified architectural, infrastructural, and provider limitations currently present in Vani AI.

---

## 1. Storage & Persistence Constraints

1. **Local SQLite File Locking in Multi-Process Production:**
   - **Constraint:** In local development, Vani AI uses SQLite via `@prisma/adapter-better-sqlite3` and `dev.db`.
   - **Limitation:** In serverless environments (Vercel, AWS Lambda) or multi-container clusters, local SQLite files are ephemeral and cannot handle concurrent write operations across multiple process instances.
   - **Production Requirement:** For enterprise multi-user deployments, the database provider should be switched to a managed PostgreSQL cluster (e.g., Supabase, Neon, AWS RDS) by configuring `DATABASE_URL` and running `prisma migrate deploy`.

2. **Temporal Scheduler In-Process Daemon:**
   - **Constraint:** The background scheduler currently runs via a Node.js `setInterval` loop (`schedulerDaemon`) inside `backend/server.js`.
   - **Limitation:** In scale-to-zero serverless deployments (such as Vercel serverless functions), the event loop freezes between HTTP requests, which will delay scheduled actions until the next invocation.
   - **Production Requirement:** For production environments hosted on serverless infrastructure, scheduled actions should be triggered via an external cron mechanism (e.g., Vercel Cron, GitHub Actions, AWS EventBridge) hitting `/api/schedule/run-due` with a pre-shared secret.

---

## 2. AI Provider Rate Limits & Regional Quotas

1. **Google Gemini API Rate Limits:**
   - **Constraint:** Complex 29-section BRD generation requires up to 4096 tokens per request.
   - **Limitation:** Free-tier or low-tier Gemini API keys can encounter temporary quota exhaustion or model availability delays (`gemini-3.8-flash` high demand spikes).
   - **Mitigation:** Vani AI implements an automatic fallback cascade (`gemini-3.8-flash` → `gemini-3.5-flash-lite`), followed by OpenAI GPT-4o if configured.

2. **Sarvam AI Indian Language Audio Processing:**
   - **Constraint:** Audio files submitted to `/api/voice/stt` must be valid WAV, MP3, or WebM audio under 10MB.
   - **Limitation:** Browsers on iOS WebKit require explicit user gesture activation to initialize `AudioContext` and microphone streams.
   - **Mitigation:** The frontend implements `MicPermissionModal` and user-initiated tap handlers before microphone capture.

3. **TinyFish Live Search & Crawler Limits:**
   - **Constraint:** TinyFish live research depends on third-party web indexing and website availability.
   - **Limitation:** Certain websites enforce Cloudflare anti-bot shields or captcha challenges that reject automated page fetching.
   - **Mitigation:** TinyFish pipeline falls back gracefully to search snippet ranking when deep fetch is blocked.

---

## 3. Security & URL Boundaries

1. **SSRF Guardrails:**
   - Internal network addresses (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, and AWS metadata `169.254.169.254`) are strictly blocked by URL sanitization.
   - External intranet or behind-firewall resources cannot be researched by design to prevent security exposure.
