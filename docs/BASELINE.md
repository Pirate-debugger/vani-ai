# Vani AI — Phase 0 Baseline & Architecture Map

## 1. Baseline Test & Build Verification

Empirical verification performed on branch `main` at commit `8445ec0`:

| Component | Command | Target | Result | Duration | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend** | `npm test` | Vitest (13 suites) | **91 / 91 passed (100%)** | 133.04s | Live E2E tests included; Gemini quota fallback cascading to `gemini-3.5-flash-lite` verified. |
| **Frontend Tests** | `npm test -- --run` | Vitest (4 suites) | **11 / 11 passed (100%)** | 2.31s | Component & hook unit tests passed. |
| **Frontend Lint** | `npm run lint` | ESLint | **0 Errors, 104 Warnings** | 7.92s | Unused variable warnings only. |
| **Frontend Build** | `npm run build` | Vite 5 | **Success (0 errors)** | 4.16s | Production bundle generated cleanly (`dist/` 399 kB main bundle). |

---

## 2. One-Page Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / BROWSER RUNTIME                              │
│  React 18 + Vite 5 + Tailwind 3 + @ricky0123/vad-web + Lucide Icons             │
│  Pages: Home, Workspace, DocumentViewer, Settings, Login, Register              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTP / JSON / SSE Streams / Audio
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             EXPRESS 4 REST API                                  │
│  Security: Helmet (CSP), Rate Limiter, CORS, Express-Session, Passport OAuth    │
└──────┬────────────┬────────────┬─────────────┬────────────┬─────────────┬───────┘
       │            │            │             │            │             │
       ▼            ▼            ▼             ▼            ▼             ▼
  /api/auth    /api/voice   /api/ai       /api/project  /api/task    /api/schedule
  (Local,      (Saaras STT, (Orchestrator,(Workspace,   (Kanban CRUD,(Temporal
   OAuth,       Bulbul TTS,  Stream SSE,   Memories,     Ownership)   Actions,
   ApiKeys)     Translate)   Sessions)     Docs)                      Daemon)
       │            │            │             │            │             │
       └────────────┼────────────┴─────────────┴────────────┴─────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CORE SERVICE LAYER                                   │
│  • orchestrator.js        : Goal decomposition, agent routing, plan synthesis   │
│  • agentRegistry.js       : 29-section BRD, research, and technical agents      │
│  • tinyfish.js            : SSRF-safe web search, fetch & content sanitization  │
│  • schedulerService.js    : Natural-language temporal parsing & cron execution  │
│  • providerRouter.js      : Capability matching & quota-aware fallback routing │
│  • crypto.js              : AES-256-GCM encryption with key versioning         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AI PROVIDER NETWORK                                  │
│  • Sarvam AI   : Saaras v4 STT, Bulbul TTS, Mayura Translation, Indic reasoning │
│  • Gemini      : gemini-3.8-flash -> gemini-3.5-flash-lite fallback chain       │
│  • OpenAI      : GPT-4o / GPT-4o-mini structured JSON synthesis                 │
│  • TinyFish    : Web search grounding, live page scraping & research           │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                     │
│  Prisma 7 ORM (better-sqlite3 adapter locally; PostgreSQL schema ready)         │
│  Models: User, ChatSession, ChatMessage, ApiKey, Project, Document,             │
│          DocumentVersion, Task, CustomAgent, AgentRun, ProjectMemory,          │
│          ScheduledAction, Session                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Exhaustive Endpoint & Authorization Matrix

| Method | Path | Description | Cost-Bearing | Auth Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Service health & provider presence check | No | **Public** |
| `POST` | `/api/auth/register` | Register new user with bcrypt hash | No | **Public** |
| `POST` | `/api/auth/login` | Authenticate with email and password | No | **Public** (Rate-limited) |
| `POST` | `/api/auth/local-login` | Guest session initialisation | No | **Public / Guest isolated** (Prod: No email passwordless) |
| `POST` | `/api/auth/logout` | Terminate session and clear cookie | No | **Session** |
| `GET` | `/api/auth/me` | Fetch active user profile | No | **Session** |
| `GET` | `/api/auth/google` | Initiate Google OAuth flow | No | **Public** |
| `GET` | `/api/auth/google/callback`| Google OAuth redirect callback | No | **Public** |
| `POST` | `/api/auth/forgot-password`| Request password reset link | No | **Public** (Generic response) |
| `POST` | `/api/auth/reset-password` | Set new password with reset token | No | **Public** |
| `POST` | `/api/auth/set-key` | Store user encrypted API key | No | **Session (Owner)** |
| `POST` | `/api/auth/clear-key` | Remove user encrypted API key | No | **Session (Owner)** |
| `GET` | `/api/auth/status` | Get API key configured status | No | **Public / Session** |
| `GET` | `/api/integrations/status`| Provider readiness metadata | No | **Public** |
| `POST` | `/api/voice/stt` | Transcribe speech with Sarvam Saaras | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/voice/tts` | Synthesize speech with Sarvam Bulbul | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/voice/translate` | Translate text via Sarvam Mayura | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/voice/bridge` | Real-time speech-to-speech bridge | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/voice/interpret` | Voice intent interpretation | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/voice/command` | Multi-modal voice command parser | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/ai/chat` | AI conversation & orchestration | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/ai/chat-stream` | Streaming chat response (SSE) | **Yes** | **Auth / Isolated Guest** |
| `POST` | `/api/ai/orchestrate-stream`| Streaming agent orchestration (SSE) | **Yes** | **Auth / Isolated Guest** |
| `GET` | `/api/ai/providers` | Provider status for active caller | No | **Session / Guest** |
| `GET` | `/api/ai/session/:sessionId/state`| Full canonical session state | No | **Owner-Checked (404 on mismatch)** |
| `GET` | `/api/projects` | List projects of logged-in user | No | **Session (Owner)** |
| `POST` | `/api/projects` | Create a new project | No | **Session (Owner)** |
| `GET` | `/api/projects/:id` | Get project details, docs, tasks | No | **Owner-Checked** |
| `PATCH` | `/api/projects/:id` | Update project metadata | No | **Owner-Checked** |
| `DELETE`| `/api/projects/:id` | Delete project and cascade items | No | **Owner-Checked** |
| `GET` | `/api/projects/:id/memory` | Retrieve project memories | No | **Owner-Checked** |
| `POST` | `/api/projects/:id/memory` | Store new project memory | No | **Owner-Checked** |
| `DELETE`| `/api/projects/:id/memory/:memoryId`| Remove project memory item | No | **Owner-Checked** |
| `GET` | `/api/document/:id` | Retrieve document and versions | No | **Owner-Checked** |
| `PATCH` | `/api/document/:id` | Update document content | No | **Owner-Checked** |
| `GET` | `/api/tasks` | List tasks for caller project | No | **Owner-Checked** |
| `POST` | `/api/tasks` | Create task in project | No | **Owner-Checked** |
| `PATCH` | `/api/tasks/:id` | Update task status or assignee | No | **Owner-Checked** |
| `DELETE`| `/api/tasks/:id` | Delete task | No | **Owner-Checked** |
| `GET` | `/api/schedule` | List scheduled actions | No | **Session (Owner)** |
| `POST` | `/api/schedule` | Create scheduled action | No | **Session (Owner)** |
| `PATCH` | `/api/schedule/:id` | Update scheduled action | No | **Owner-Checked** |
| `DELETE`| `/api/schedule/:id` | Cancel/delete scheduled action | No | **Owner-Checked** |
| `POST` | `/api/schedule/:id/run` | Trigger scheduled action now | **Yes** | **Owner-Checked** |
