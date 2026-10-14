# Vani AI — Baseline Actual State & Source-of-Truth Audit
**Audit Date:** 15 October 2026  
**Auditor:** Principal Full-Stack Engineer, AI Platform Architect, Application Security Engineer & QA Lead  
**Evaluation Target:** Node.js v20+ / Express 4.x / Prisma 7.x / React 18.x / Vite 5.x / Tailwind CSS  

---

## 1. Feature Classification Matrix (Empirically Verified)

| Component / Subsystem | Status | Empirical Verification Notes | Action Required |
| :--- | :--- | :--- | :--- |
| **Local & OAuth Auth** | **WORKING** | bcrypt password hashing, session fixation regeneration on login/register, Google OAuth support. | Retain and enforce strict session secret in production. |
| **Guest Isolation** | **WORKING** | `backend/routes/auth.js` provisions unique UUIDs `guest_${Date.now()}_${hex}` in DB with 24-hr TTL. Cross-user isolation tests pass (19/19 in `security.test.js`). | Retain. Prevent any fallback to shared IDs. |
| **Object Authorization (IDOR)** | **WORKING** | `verifyProjectOwnership` and `verifyDocumentOwnership` protect resources. `GET /api/ai/session/:sessionId/state` is protected with `requireAuth`. | Retain. |
| **Database & Migrations** | **PARTIAL** | SQLite works locally. However, `migration_lock.toml` declares `provider = "sqlite"`. Running PostgreSQL migrations with that lock will fail. `prisma.js` falls back to `/tmp/dev.db` on Vercel if `DATABASE_URL` is absent. | Fix provider migration separation and enforce explicit fail-fast if `DATABASE_URL` is missing in production. |
| **Production Session Secrets** | **BROKEN / P0** | `backend/server.js` allowed missing `SESSION_SECRET` on Vercel to fall back to an ephemeral random secret (`vani-prod-session-fallback-${randomBytes}`). On serverless, different cold starts invalidate user sessions. | Fail fast in production if `SESSION_SECRET` is missing or placeholder. |
| **Database Health Exposure** | **BROKEN / P0** | `/api/health/ready` returns raw `dbErr.message` to anonymous clients on error. | Sanitize error output in production; log diagnostic details securely. |
| **Sarvam AI Integration** | **WORKING (LIVE)** | Tested live: `https://api.sarvam.ai/v1/models` (200 OK), Chat (`sarvam-105b-conversations`), TTS with `bulbul:v3` (speakers: `priya`, `ritu`, `neha`, `pooja`, `rohan`, `aditya`, etc.). | Ensure valid speaker selection and configurable models. |
| **Google Gemini Integration** | **WORKING (LIVE)** | Tested live: `gemini-3.8-flash` and `gemini-3.5-flash-lite` active and functioning. Structured JSON document generation and streaming verified. | Adjust timeouts for large document generation to avoid premature 25s cut-off. |
| **OpenAI Integration** | **PARTIAL (CREDITS)** | API key is authentic and connects to `api.openai.com` (127 models listed), but organization account has exhausted credits (`429 You have no credits remaining`). | Truthful 429/503 handling with seamless fallback to Gemini/Sarvam. |
| **TinyFish Live Web Research** | **WORKING (LIVE)** | Tested live: `client.search.query` returned authentic search results. Search + Fetch pipeline active. | Tighten SSRF checks for IPv4-mapped IPv6, decimal/octal/hex IP encodings, and link-local ranges. |
| **Frontend API Contract** | **BROKEN / P0** | `buildApiUrl` in `frontend/src/lib/api.js` duplicates `/api` if `VITE_API_URL` already ends in `/api`. | Fix path normalization and add comprehensive regression tests. |
| **Temporal Scheduler** | **PARTIAL** | Natural language intent parsing works. In-process `setInterval` daemon works for persistent servers (Node/Docker), but cannot persist on serverless scale-to-zero. | Provide external secure cron trigger (`POST /api/schedule/cron-trigger`) with secret validation. |
| **UI / Workspace Composer** | **PARTIAL** | Functional chat and split document view. Needs compact VoiceOrb/HUD integration, sticky bottom composer with IME safe input, accessible focus rings, and polished modern styling. | Redesign according to Phase 4 UI/UX requirements. |

---

## 2. Baseline Test Execution Results

1. **Backend Tests:** 16 test files (111 tests). After injecting fresh valid credentials, all 16 test files pass.
2. **Frontend Tests:** 4 test files (11 tests) passed.
3. **Frontend Production Build:** Vite build succeeded (`dist/index.html`, `dist/assets/*`).
4. **Backend Entrypoint:** `node -e "import('./backend/server.js')"` loads cleanly with exit code 0.
