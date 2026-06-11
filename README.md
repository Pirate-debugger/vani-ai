# 🎙️ Vani AI — Saaras-Bulbul v3

> **Voice-first multilingual AI assistant for Bharat** — powered by Sarvam AI, built for India's 1.4 billion voices.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![Sarvam AI](https://img.shields.io/badge/Sarvam%20AI-Saaras%20v3%20%7C%20Bulbul%20v2-orange)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

Vani AI is a premium, dark-themed voice assistant that speaks and understands **8 Indian languages** — Hindi, English, Marathi, Tamil, Telugu, Bengali, Gujarati, and Kannada. It runs in both simulator mode (no API key required) and full production mode connected to Sarvam AI's state-of-the-art Indian language models.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎙️ **Speech-to-Text** | Sarvam Saaras v3 — best-in-class Indian ASR |
| 🔊 **Text-to-Speech** | Sarvam Bulbul v2 — 7 voice personas (Anushka, Abhilash, Arya…) |
| 🌐 **Translation** | Sarvam Mayura v1 — cross-Indian-language translation |
| 🤖 **LLM** | Sarvam-105B → Sarvam-30B → GPT-4o-mini → Gemini 2.5 Flash (cascading fallback) |
| 🔀 **Bridge Mode** | Speak Hindi, get a Tamil reply — full bilingual live pipeline |
| 💬 **Chat History** | Persistent sessions saved per user (localStorage) |
| 🔐 **Login / Guest Mode** | ChatGPT-style auth — use without account or save history with one |
| 👤 **User Profile** | Personalize AI by state, occupation, age group & preferred topics |
| 🌙 **Cyberpunk UI** | Dark glassmorphism, glowing orbs, micro-animations |
| 📱 **Responsive** | Works on mobile and desktop |

---

## 🖼️ Screenshots

| Chat Assistant | Voice Mode |
|---|---|
| ![Chat](docs/screenshot-chat.png) | ![Assistant](docs/screenshot-assistant.png) |

---

## 🚀 Quick Start

### Option 1: One-Command Production Deploy (Docker)

Ensure you have Docker and Docker Compose installed.

```bash
git clone https://github.com/your-username/vani-ai.git
cd vani-ai

# Copy production env and add your passwords/keys
cp .env.production.example .env

# Spin up the PostgreSQL DB and Node backend
docker-compose up -d --build
```
Vani AI will now be running on **http://localhost:5000**.

### Option 2: Local Development Setup

#### Prerequisites
- Node.js 20+
- npm 9+

#### 1. Clone & install

```bash
git clone https://github.com/your-username/vani-ai.git
cd vani-ai

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies (open a new terminal)
cd frontend && npm install
```

#### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your API keys
```

#### 3. Run development servers (Two Terminal Windows)

```bash
# Terminal 1 (Backend)
cd backend && npm run dev

# Terminal 2 (Frontend)
cd frontend && npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## 🔑 Environment Variables

| Variable | Context | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | Docker | Database password for the Postgres container |
| `SESSION_SECRET` | Backend | Cryptographic secret for express-session |
| `ENCRYPTION_KEY` | Backend | 32-byte hex string for AES-256-GCM API Key encryption |
| `SARVAM_API_KEY` | Backend | (Optional) Sarvam AI subscription key — [sarvam.ai](https://sarvam.ai) |
| `OPENAI_API_KEY` | Backend | (Optional) GPT-4o-mini fallback |
| `GEMINI_API_KEY` | Backend | (Optional) Gemini 2.5 Flash fallback |
| `GOOGLE_CLIENT_ID` | Backend | (Optional) Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | (Optional) Google OAuth Client Secret |

> Without any API key, Vani AI safely falls back to **Simulator Mode** using pre-built Indian language responses and browser speech synthesis.

---

## 🏗️ Architecture

```
vani-ai/
├── frontend/          # React + Vite
│   └── src/
│       ├── context/   # AuthContext, ChatHistoryContext
│       ├── components/ # Sidebar, VoiceOrb, SuggestionCards
│       ├── pages/     # Home, Chat, Assistant, Settings, Login
│       └── hooks/     # useVoiceRecorder (STT + TTS)
├── backend/           # Express.js
│   ├── routes/
│   │   ├── ai.js      # LLM chat completions (Sarvam → OpenAI → Gemini)
│   │   ├── voice.js   # STT, TTS, Translation, Bridge Mode
│   │   └── auth.js    # Session-based API key storage
│   └── server.js      # Serves React static files in production
├── .github/workflows  # CI/CD pipelines
├── docker-compose.yml # PostgreSQL + Node.js orchestrator
└── .env.production.example # Production environment template
```

---

## ☁️ CI/CD

Vani AI includes a pre-configured **GitHub Actions Workflow** (`.github/workflows/ci.yml`) that automatically runs the Vitest unit tests (Frontend & Backend) and ESLint on every push or pull request to ensure deployment stability.

---

## 📄 License

MIT © 2026 Vani AI — Antigravity
