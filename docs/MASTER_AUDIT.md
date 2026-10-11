# Vani AI — Master Codebase Audit
**Date:** October 11, 2026  
**Auditor:** Senior Staff Engineer, AI Systems Architect, Application Security Engineer & QA Lead  
**Commit Baseline:** `c8caee3`  
**Target Environment:** Node.js v25.x / Express 4.x / Prisma 7.x / React 18.x / Vite 5.x / Tailwind CSS  

---

## 1. Executive Summary & Verification Matrix

Vani AI is designed as an India-first, voice-first AI workspace featuring multilingual interaction (Hindi, Hinglish, English), autonomous web research via TinyFish, structured enterprise artifact generation (BRD, PRD, Technical Specifications), and temporal action scheduling.

An end-to-end audit of all backend services, routes, middleware, database schemas, frontend components, and test suites was conducted. The features have been empirically evaluated and classified under the required taxonomy: **WORKING**, **PARTIAL**, **BROKEN**, **MOCKED / DEMO ONLY**, **NOT IMPLEMENTED**, or **NOT VERIFIED**.

| System Component | Actual State | Primary Risks / Vulnerabilities | File Paths |
| :--- | :--- | :--- | :--- |
| **Local & Google Authentication** | WORKING | Session secret checks active in production; Google OAuth flow working. | `backend/routes/auth.js`, `backend/server.js` |
| **Guest Mode Isolation** | **BROKEN / SEVERE** | All guest users share the hardcoded user ID `guest_user` and email `guest@vani.ai`. Guest A projects, chats, and documents are accessible to Guest B. | `backend/routes/auth.js:174` |
| **Object Authorization (IDOR)** | PARTIAL | `verifyProjectOwnership` and `verifyDocumentOwnership` protect documents, projects, and tasks; however, `GET /api/ai/session/:sessionId/state` allows unauthenticated access if `req.user` is null. Missing project check if `projectId` is passed without authenticated user in `orchestrate()`. | `backend/routes/ai.js:272`, `backend/services/orchestrator.js:60` |
| **Database & Deployment** | PARTIAL | Prisma 7 configured with SQLite (`dev.db`). Not safe for multi-container / serverless deployment without PostgreSQL adapter. | `backend/prisma/schema.prisma`, `backend/prisma.config.ts` |
| **Canonical Orchestrator** | WORKING | Orchestrates Auto, BRD, Research, Technical, and Custom Agents. Dynamically evolutive sessions. Token streaming via SSE. Idempotency cached. | `backend/services/orchestrator.js`, `backend/routes/ai.js` |
| **Agent Run Durability** | PARTIAL | `AgentRun`, `AgentStep`, and `ToolExecution` tables exist and are created when `requestId` is provided. However, run recovery and browser reconnect for incomplete runs need formal state machine enforcement. | `backend/prisma/schema.prisma:161`, `backend/services/orchestrator.js:101` |
| **Sarvam AI Provider** | WORKING | Real STT (`saaras:v4`), TTS (`bulbul:v3`), and Translation (`mayura:v1`). Truthful 503 if unconfigured. | `backend/services/providers/sarvamProvider.js`, `backend/routes/voice.js` |
| **Google Gemini Provider** | WORKING | Structured document generation, long-context analysis, token streaming. Auto-fallback from `gemini-3.8-flash` to `gemini-3.5-flash-lite`. | `backend/services/providers/geminiProvider.js`, `backend/services/llm.js` |
| **OpenAI Provider** | WORKING | Chat completion and structured extraction with GPT-4o. Truthful error if key is absent. | `backend/services/providers/openaiProvider.js` |
| **TinyFish Live Research** | PARTIAL | Focused 4-stage pipeline (Search → Rank → Fetch → Evidence Extraction). **Lacks SSRF & IP loopback validation** on target URLs (`localhost`, `169.254.x.x`). | `backend/services/tinyfish.js:135` |
| **Evidence Inspector** | WORKING | Modal displays grounded sources, confidence ratings, and quotes with links. | `frontend/src/components/EvidenceInspector.jsx` |
| **Custom Agent Builder** | WORKING | Template catalog (10 canonical templates) + custom agent CRUD with permitted tools and autonomy level. | `backend/routes/customAgent.js`, `frontend/src/components/CustomAgentModal.jsx` |
| **Temporal Scheduler** | WORKING | Parses natural language timeframes (*"Tomorrow at 8pm"*, *"Every Sunday at 8pm IST"*). In-process interval runner + API routes. Not persistent across serverless restarts. | `backend/services/schedulerService.js`, `backend/routes/schedule.js` |
| **Document Engine & Versions** | WORKING | Markdown/JSON persistence, automated task extraction, version creation on update, export to MD/JSON/HTML/Printable PDF. | `backend/routes/document.js`, `frontend/src/components/DocumentViewer.jsx` |
| **Project Knowledge Ingestion**| NOT IMPLEMENTED | UI displays Project Memory, but PDF/DOCX multi-format file ingestion and section provenance are pending. | `backend/prisma/schema.prisma:213` |
| **Voice Orb & Audio UX** | PARTIAL | Full Web Audio / VAD recorder hook. VoiceOrb exists but currently takes excessive vertical space on Workspace idle state instead of compact composer integration. | `frontend/src/components/VoiceOrb.jsx`, `frontend/src/pages/Workspace.jsx` |

---

## 2. In-Depth Vulnerability & Architectural Findings

### 2.1 Critical Vulnerability: Guest User Collocation (Severity: HIGH)
- **File:** `backend/routes/auth.js:173-195`
- **Issue:** When a user logs in via `/api/auth/local-login` with `{ isGuest: true }`, the backend assigns the fixed ID:
  ```javascript
  const userId = isGuest ? 'guest_user' : ...;
  const userEmail = isGuest ? 'guest@vani.ai' : ...;
  ```
- **Reproduction Steps:**
  1. Open Browser Window 1 in Incognito. Click "Continue as Guest". Create a Project named "Confidential Startup 1".
  2. Open Browser Window 2 in Incognito. Click "Continue as Guest".
  3. Load `/api/projects`. Window 2 receives "Confidential Startup 1" because both share `userId: 'guest_user'`.
- **Remediation Required:** Each guest session must be provisioned with an isolated UUID (`guest_${crypto.randomUUID()}`), stored in their express session, with ephemeral TTL and explicit isolation.

### 2.2 Security Flaw: Unauthenticated Read on Session State (Severity: MEDIUM)
- **File:** `backend/routes/ai.js:272-302`
- **Issue:** The endpoint `GET /api/ai/session/:sessionId/state` has the check:
  ```javascript
  if (authUser?.id && session.userId !== authUser.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this session' });
  }
  ```
  If `authUser` is `null` (unauthenticated client), this conditional evaluates to `false`, allowing an unauthenticated visitor to fetch the complete session history, tasks, and project details.
- **Remediation Required:** Enforce `requireAuth` middleware on `GET /api/ai/session/:sessionId/state`.

### 2.3 SSRF (Server-Side Request Forgery) in TinyFish Fetch (Severity: HIGH)
- **File:** `backend/services/tinyfish.js:120-173`
- **Issue:** `fetchWeb(url)` and `runWebAgent(url, goal)` accept arbitrary URL strings without validating whether the hostname resolves to internal, private, or cloud metadata IP ranges (`127.0.0.1`, `localhost`, `169.254.169.254`, `10.0.0.0/8`, `192.168.0.0/16`).
- **Remediation Required:** Implement `validateAndSanitizeUrl(url)` with strict IP loopback filtering and protocol allowlisting (`http:`, `https:` only).

### 2.4 Orchestrator Missing Unauthenticated Project Ownership Enforcement (Severity: MEDIUM)
- **File:** `backend/services/orchestrator.js:60-71`
- **Issue:**
  ```javascript
  let verifiedProject = null;
  if (projectId && userId) {
    try {
      verifiedProject = await verifyProjectOwnership(projectId, userId);
    } catch (authErr) { ... }
  }
  ```
  If an unauthenticated request provides a `projectId` without a `userId`, the ownership verification is skipped entirely.
- **Remediation Required:** If `projectId` is present, `userId` must be non-null and verified. Reject with 401/403 immediately.

---

## 3. UI/UX & Design System Deficiencies

1. **Workspace Visual Clutter & Giant VoiceOrb:**
   - On the `Workspace.jsx` page, when no audio is recording, the `VoiceOrb` dominates the primary view, pushing the conversation flow and deliverable workspace downwards.
   - Requirement: Integrate a compact, elegant voice badge/trigger into the composer when idle, expanding into a focused audio HUD only when active.
2. **Global Text Selection & Styling Tokens:**
   - Some container components have had `user-select: none` or arbitrary utility padding that interferes with copying code blocks and requirements text.
   - Typography uses ad-hoc styles rather than a unified design token scale for font sizes, spacing, and subtle borders.
3. **Empty State Guidance:**
   - First-time users see a blank slate without crisp starter actions (e.g., "Ask Vani", "Research Competitors", "Create a BRD").
4. **Header Metrics on Empty Selection:**
   - The top navigation bar renders "0 Docs", "0 Tasks" badges even when no project has been selected yet.

---

## 4. Test Suite Baseline Execution

All baseline automated checks were run on October 11, 2026:

- **Backend Test Suite:**
  - `npx vitest run tests/auth.test.js tests/security.test.js tests/voice.test.js tests/customAgent.test.js tests/jsonParser.test.js tests/orchestrator.test.js tests/scheduler.test.js tests/tinyfish.test.js tests/brdAgent.test.js tests/ai.test.js`: **10 files passed (62 tests), 0 failures.**
  - `npx vitest run tests/providers.test.js`: **1 file passed (18 tests), 0 failures.**
  - `npx vitest run tests/chatToAgentEvolution.test.js`: **1 file passed (1 test), 0 failures.**
  - `npx vitest run tests/workspaceE2E.test.js`: **1 file passed (3 tests), 0 failures.**
  - **Total Backend Tests: 84 passed, 0 failed.**
- **Frontend Test Suite:**
  - `npm --prefix frontend test -- --run`: **4 files passed (11 tests), 0 failures.**
- **Frontend Lint:**
  - `npm --prefix frontend run lint`: **0 errors, 127 warnings** (unused imports / hooks dependencies).
- **Frontend Production Build:**
  - `npm --prefix frontend run build`: **Vite production build passed in 9.80s** (`dist/index.html` 1.97 kB, JS/CSS assets bundled cleanly).
