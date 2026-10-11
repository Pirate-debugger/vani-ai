# Vani AI — Phased Implementation Plan
**Date:** October 11, 2026  
**Target Completion:** Production Hardened Release  

---

## Phase 1: Security & Persistence Hardening (Immediate Priority)

### Objectives
1. **Eliminate Shared Guest User Collocation:**
   - Provision every guest with an isolated, unique UUID identity in `backend/routes/auth.js` (`guest_<uuid>`).
   - Store the guest record in Prisma and tie all projects, sessions, documents, and tasks strictly to that isolated ID.
   - Prevent any guest from accessing another guest's data.
2. **Close Unauthenticated Session State Hole:**
   - Protect `GET /api/ai/session/:sessionId/state` with `requireAuth`.
   - Ensure an unauthenticated request returns `401 UNAUTHORIZED`.
3. **SSRF & Dangerous URL Prevention in Web Research:**
   - Build `validateAndSanitizeUrl(url)` utility blocking `localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.169.254`, RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and non-HTTP/HTTPS protocols.
   - Apply validator before invoking `fetchWeb` or `runWebAgent` in `backend/services/tinyfish.js`.
4. **Enforce Project Ownership in Orchestrator:**
   - In `backend/services/orchestrator.js`, if `projectId` is provided without a valid `userId`, reject immediately with `401 UNAUTHORIZED`.
5. **Automated Security Verification:**
   - Add automated test cases in `backend/tests/security.test.js` validating:
     - Cross-guest project isolation (Guest A cannot see or access Guest B's projects).
     - Unauthenticated rejection on `/api/ai/session/:sessionId/state`.
     - SSRF rejection on `http://127.0.0.1:5000`, `http://localhost`, and `http://169.254.169.254`.

---

## Phase 2: Orchestration Reliability & Durable Run State Machine

### Objectives
1. **Formal Run State Machine:**
   - Ensure all `AgentRun` transitions adhere to: `queued` → `running` → (`waiting_for_approval` | `paused`) → `completed` | `failed` | `cancelled`.
   - Implement graceful cancellation when user aborts or connection drops.
2. **Durable Reconnection & Idempotency:**
   - Provide recovery endpoints to fetch pending step details for long-running jobs.
   - Prevent duplicate tool calls or repeated document creation on retry.

---

## Phase 3: AI Provider & Research Integrity

### Objectives
1. **Untrusted Web Content Sanitization:**
   - Treat all web fetched pages and search results as untrusted external content.
   - Strip system prompt override attempts (prompt injection guard) before passing crawled snippets into Gemini/OpenAI prompts.
2. **Evidence Grounding Verification:**
   - Guarantee that confidence ratings in research artifacts are derived strictly from empirical domain signals, metric density, and page corroboration.

---

## Phase 4: Premium UI/UX Workspace Redesign

### Objectives
1. **Unified Design System Tokens:**
   - Define clean CSS custom properties and tailwind tokens for a calm, professional palette (slate/indigo accents, subtle borders, accessible contrast).
2. **Workspace Layout Refinement:**
   - **Sidebar:** Clean, intuitive grouping (New Chat, Conversations, Projects, Work [Documents, Tasks, Research, Scheduled Actions], Agents, Settings).
   - **Top Bar:** Project selector with clean empty state (hide zero badges when no project is active).
   - **Empty State:** Clean greeting, 3 starter action pills (*Ask Vani*, *Research Competitors*, *Create a BRD*).
   - **Composer:** Auto-expanding multiline input, integrated compact voice trigger, file attach, submit, and abort controls.
   - **Voice HUD:** Compact badge in idle state; transforms into a clean non-intrusive floating HUD during active audio capture.
3. **Accessibility & Responsive Geometry:**
   - Ensure complete responsiveness down to 360px mobile viewports.
   - Restore natural text selection on all document viewer and chat transcript elements.

---

## Phase 5: Project Knowledge & Differentiating Features

### Objectives
1. **Project Knowledge Ingestion:**
   - Ingest markdown, text, and structured files into `ProjectMemory` with section tagging and timestamps.
2. **Document Version Diffing:**
   - Enable side-by-side or inline comparison between document versions in `DocumentViewer.jsx`.
3. **End-to-End Regression Testing:**
   - Validate full flow across all features and document test outcomes.
