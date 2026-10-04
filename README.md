# 🎙️ Vani AI — Multilingual Voice-First AI Business Assistant & Startup Copilot

> **Voice-first multilingual AI business assistant and startup copilot for India** — powered by Sarvam AI for Indic voice & speech, TinyFish for autonomous live web intelligence, Google Gemini & OpenAI for structured requirements reasoning, and Prisma SQLite/PostgreSQL for persistent execution.

![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![Sarvam AI](https://img.shields.io/badge/Sarvam%20AI-Saaras%20v3%20%7C%20Bulbul%20v2-orange)
![TinyFish](https://img.shields.io/badge/TinyFish-Web%20Agent%20%26%20Search-cyan)
![Prisma](https://img.shields.io/badge/Prisma-7.8-indigo?logo=prisma)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

---

## 📖 1. What is Vani AI?

Vani AI is a voice-first, multilingual AI business copilot designed for Indian founders, product managers, and builders. You can speak naturally in **Hindi, Hinglish, or English** (as well as 8+ regional Indian languages) to:
- Generate complete, 27-section **Business Requirements Documents (BRDs)**
- Conduct **live web competitor analysis** via TinyFish
- Automatically extract and track **actionable delivery tasks**
- Receive **short, concise voice responses** synthesized in your language
- Manage and version project documents securely with IDOR-protected role controls

---

## 🏗️ 2. Architecture & Pipeline

```
USER VOICE COMMAND
       │
       ▼
1. Sarvam Saaras v3 STT (Speech-to-Text)
       │
       ▼
2. Intent Router (Classifier)
       │
       ├─► Does task require live web data?
       │     ├─► NO  ─► Standard LLM Reasoning
       │     └─► YES ─► TinyFish Search & Web Agent ──┐
       │                                              │
       ▼                                              ▼
3. BRD Generation Agent (27-Section Architecture) ◄───┘
       │
       ▼
4. Robust JSON Parser & Schema Validator (with Repair Recovery)
       │
       ▼
5. Prisma Atomic Transaction
       ├─► Document (BRD)
       ├─► DocumentVersion (Snapshot v1.0)
       └─► Task Extraction (Deduplicated Implementation Tasks)
       │
       ▼
6. Sarvam Bulbul v2 TTS (<350 chars concise spoken confirmation)
       │
       ▼
7. Real-Time Project Dashboard & TaskBoard
```

---

## ✨ 3. Core Features

| Category | Capability | Technology |
|---|---|---|
| 🎙️ **Voice First** | Speech recognition in Indian accents & dialects | Sarvam Saaras v3 ASR |
| 🔊 **Voice Feedback** | Natural regional voice output (<350 chars) | Sarvam Bulbul v2 TTS |
| 🌐 **Live Web Intelligence** | Real-time competitor pricing, market signals & web scraping | TinyFish TypeScript SDK (`@tiny-fish/sdk`) |
| 📋 **BRD Generation** | 27-section enterprise Business Requirements Document | Gemini 2.0 Flash / OpenAI GPT-4o |
| 🎯 **Task Extraction** | Deduplicated high/medium/low priority action items | Deterministic Task Extractor |
| 🔒 **Enterprise Security** | IDOR prevention, project ownership verification, safe errors | Express middleware + AES-256-GCM |
| 🔀 **Bridge / Interpreter** | Live bilingual voice bridge (e.g. Hindi ⇄ Tamil) | Sarvam Mayura v1 Translation |
| 🌙 **Cyberpunk UI** | Dark glassmorphism, responsive TaskBoard & DocumentViewer | Tailwind CSS + Lucide React |

---

## 🗣️ 4. Example Voice Commands

| User Voice Input | Intent | Action Executed | Spoken Response |
|---|---|---|---|
| *"Vani, student PG finder startup ka BRD banao aur competitors research karo."* | `brd` + `research` | Triggers TinyFish search for PG competitors, synthesizes 27-section BRD, saves document and extracts tasks. | *"BRD ready hai. Maine competitor research, 10 functional requirements aur 7 implementation tasks add kiye hain."* |
| *"Vani, mere startup ka BRD bana do."* | `brd` | Generates 27-section BRD, creates atomic Document + Tasks. | *"Aapka BRD document ready hai. Maine 8 action items add kiye hain."* |
| *"Vani, show me the tasks from the BRD."* | `task_command` | Fetches project tasks owned by authenticated user. | *"Task 1: Setup Student Auth (pending). Task 2: Integrate Map Search..."* |
| *"Mark task 1 as done."* | `task_command` | Updates task status to `done` after verifying user ownership. | *"Task 'Setup Student Auth' status updated to done."* |

---

## 📋 5. BRD Document Structure (27 Sections)

Every generated BRD strictly complies with enterprise requirements engineering:

1. **Executive Summary**
2. **Business Background**
3. **Problem Statement**
4. **Business Objectives**
5. **Goals**
6. **Success Criteria**
7. **Stakeholders**
8. **Target Users**
9. **User Personas**
10. **Current State**
11. **Proposed Solution**
12. **Functional Requirements** (`FR-001` to `FR-008` with Actor, Priority, Expected Outcome)
13. **Non-Functional Requirements** (`NFR-001` Performance, Security, Scalability, Availability)
14. **Business Rules**
15. **User Workflows**
16. **Data Requirements**
17. **Integration Requirements**
18. **Dependencies**
19. **Assumptions**
20. **Constraints**
21. **Risks and Mitigation**
22. **KPIs**
23. **Competitor/Market Analysis** (Ground in real TinyFish findings when research is enabled)
24. **Open Questions**
25. **MVP Scope**
26. **Future Scope**
27. **Implementation Priorities**

---

## 🐟 6. TinyFish Web Agent Integration

TinyFish is integrated strictly on the **backend** using `@tiny-fish/sdk`. TinyFish credentials (`TINYFISH_API_KEY`) are kept confidential on the server and are never exposed to the frontend.

### Capabilities:
- `searchWeb(query)`: Autonomous web search queries with timeout and retry handling.
- `fetchWeb(url)`: Clean HTML-to-markdown extraction for specific competitor pages.
- `runWebAgent(url, goal)`: Multi-step browser automation for interactive web tasks.
- `researchForBRD(prompt)`: Formulates targeted search queries, selects sources, normalizes signals (competitors, pricing, market size), and feeds structured research to the LLM.

If TinyFish is unconfigured or encounters a network error, Vani AI continues gracefully using internal domain knowledge without fabricating sources or crashing.

---

## 🔑 7. Environment Variables

Create `backend/.env` based on `backend/.env.example`:

```ini
# Backend Server
PORT=5000
DATABASE_URL="file:./prisma/dev.db"

# AI Provider Keys
SARVAM_API_KEY=your_sarvam_api_key
TINYFISH_API_KEY=your_tinyfish_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Security & Sessions
SESSION_SECRET=replace-with-long-random-string-min-32-chars
ENCRYPTION_KEY=your-32-byte-hex-string-for-aes-256-gcm

# Client & CORS
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGIN=http://localhost:3000,http://localhost:5173
```

---

## 🚀 8. Local Setup & Running

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Install Dependencies
```bash
# In project root
npm run install-all
```

### 2. Database Migration & Prisma Client
```bash
cd backend
npx prisma generate
```

### 3. Run Development Servers
```bash
# In project root (starts backend on :5000 and frontend on :5173 concurrently)
npm run dev
```

Or run them individually:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🧪 9. Running Tests

Automated tests mock all external AI services and do NOT require live credentials or internet access.

```bash
# Run Backend Test Suite (Auth, Security, BRD, TinyFish, JSON Parser, Voice)
cd backend && npm test

# Run Frontend Test Suite (Voice Recorder Hook, Audio, VAD)
cd frontend && npm test
```

---

## 🛡️ 10. Security & Authorization

- **IDOR Protection**: Every request to `/api/projects/:id`, `/api/document/:id`, `/api/tasks/:id`, and `/api/export/:id` verifies that the resource belongs to a project owned by the authenticated session user.
- **Session Authentication**: Uses secure HTTP-only cookies (`connect.sid`).
- **Sanitized Errors**: No raw database internals, filesystem paths, or stack traces are leaked to clients.
- **Protected Secrets**: API keys are encrypted at rest using AES-256-GCM.

---

## 📄 License

MIT © 2026 Vani AI — Antigravity
