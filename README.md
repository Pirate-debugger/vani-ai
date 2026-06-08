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

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & install

```bash
git clone https://github.com/your-username/vani-ai.git
cd vani-ai

# Install all dependencies
npm run install-all
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your API keys
```

### 3. Run development servers

```bash
# Start both frontend + backend concurrently
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SARVAM_API_KEY` | Recommended | Sarvam AI subscription key — get at [sarvam.ai](https://sarvam.ai) |
| `OPENAI_API_KEY` | Optional | GPT-4o-mini fallback |
| `GEMINI_API_KEY` | Optional | Gemini 2.5 Flash fallback |
| `ALLOWED_ORIGIN` | Optional | Frontend origin for CORS (default: `http://localhost:5173`) |
| `SESSION_SECRET` | Optional | Change in production |
| `PORT` | Optional | Backend port (default: `5000`) |

> Without any API key, Vani AI runs in **Simulator Mode** with pre-built Indian language responses and browser speech synthesis.

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
└── backend/           # Express.js
    └── routes/
        ├── ai.js      # LLM chat completions (Sarvam → OpenAI → Gemini)
        ├── voice.js   # STT, TTS, Translation, Bridge Mode
        └── auth.js    # Session-based API key storage
```

---

## ☁️ Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
# Deploy dist/ to Vercel
```

### Backend → Railway

1. Create a new Railway project
2. Connect your GitHub repo
3. Set root directory to `backend/`
4. Add environment variables from `.env.example`
5. Railway auto-deploys on push

---

## 📄 License

MIT © 2026 Vani AI — Antigravity
