# Contributing to Vani AI

Thank you for your interest in contributing to Vani AI! We are building an India-first, multilingual, voice-first AI startup copilot.

## Code of Conduct

Please maintain an inclusive, constructive, and respectful environment for all contributors.

## Architecture Overview

Vani AI is organized as a monorepo:
- `backend/`: Express.js API, Prisma ORM (SQLite / PostgreSQL dual adapter), multi-AI provider router (Sarvam, Gemini, OpenAI, TinyFish), agent orchestration, and scheduler daemon.
- `frontend/`: React 18, Vite, TailwindCSS, `@ricky0123/vad-web` voice activity detector, React Router 7.
- `docs/`: Architecture specifications, baseline benchmarks, and security documentation.

## Development Workflow

Follow the repository rules: `SPEC -> PLAN -> EXECUTE -> VERIFY -> COMMIT`.

1. **Prerequisites**: Node.js 20+, npm 10+.
2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npx prisma generate
   npx prisma db push
   npm test
   ```
3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run lint
   npm test
   npm run build
   ```

## Commit Standards

One task = one commit. Use standard Conventional Commits:
- `feat(scope): description`
- `fix(scope): description`
- `test(scope): description`
- `docs(scope): description`
- `refactor(scope): description`

## Pull Request Guidelines

1. Ensure all backend tests pass: `cd backend && npm test`.
2. Ensure frontend passes lint, tests, and build: `cd frontend && npm run lint && npm test && npm run build`.
3. Never weaken security checks or log raw credentials.
4. Provide empirical evidence (test logs, build output) in your pull request description.
