# Vani AI — Production Deployment Guide

## 1. Architecture Overview
Vani AI is architected as a coherent monorepo deployable on **Vercel** with:
- **Frontend**: React 18 SPA built with Vite (`frontend/dist`), styled with Tailwind CSS and responsive design tokens.
- **Backend API**: Node.js Express serverless API exported via [`api/index.js`](file:///e:/ANTIGRVITY/vani%20ai/api/index.js) handling all `/api/*` routes.
- **Database**: PostgreSQL hosted on managed cloud infrastructure (Supabase, Neon, AWS RDS) accessed through Prisma ORM with connection pooling.
- **AI Services**: Multi-provider architecture with unified fallback:
  - **Sarvam AI**: Saaras v4 STT, Bulbul TTS, and Indic language translation.
  - **Google Gemini**: Document synthesis, BRDs/PRDs, long-context analysis.
  - **OpenAI**: Technical workflows, structured schemas, code reasoning.
  - **TinyFish**: Live web search and URL content fetching.

---

## 2. Prerequisites
- **Node.js**: `^18.18.0 || >=20.0.0`
- **npm**: `>=9.0.0`
- **PostgreSQL**: Version 14+ with SSL enabled.

---

## 3. Environment Variables

> [!IMPORTANT]
> Never commit actual secret keys or credentials to Git repositories. Configure these securely in the Vercel Dashboard under **Project Settings → Environment Variables**.

| Variable Name | Required | Description | Example / Format |
|---|---|---|---|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string (use connection pooler) | `postgresql://user:pass@host:5432/db?sslmode=require&pgbouncer=true` |
| `SESSION_SECRET` | Yes | Cryptographic secret for signing session cookies (min 32 chars) | Random 64-char hex string |
| `JWT_SECRET` | Yes | Cryptographic secret for signing JWT tokens | Random 64-char hex string |
| `FRONTEND_URL` | Optional | Custom domain for CORS allowlisting | `https://vani.yourdomain.com` |
| `PORT` | Optional | Port for local server execution (defaults to 5000) | `5000` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for document & analysis workflows | `AIzaSy...` |
| `SARVAM_API_KEY` | Optional | Sarvam AI key for voice STT, TTS and translation | UUID format key |
| `OPENAI_API_KEY` | Optional | OpenAI API key for reasoning & structured output | `sk-proj-...` |
| `TINYFISH_API_KEY` | Optional | TinyFish API key for live web search & scraping | API key |

---

## 4. Vercel Configuration & Routing
The repository includes a top-level [`vercel.json`](file:///e:/ANTIGRVITY/vani%20ai/vercel.json):
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
### Why this configuration solves Vercel deployment issues:
1. **Prevents HTML-on-API Error**: Earlier configurations used a single catch-all rewrite to `/index.html`, which hijacked `/api/*` endpoints and returned HTML pages with 200 OK. The dedicated `/api/(.*)` rewrite guarantees all API calls hit the Express handler.
2. **Serverless Compatibility**: [`api/index.js`](file:///e:/ANTIGRVITY/vani%20ai/api/index.js) exports the Express application as a serverless handler without binding to a port (`app.listen`), preventing serverless process conflicts.
3. **SPA Deep Linking**: Catch-all `/(.*)` rewrites route directly to `frontend/dist/index.html` so client-side React Router deep links (`/project/:id`, `/dashboard`, `/settings`) resolve correctly on page refresh.

---

## 5. Deployment Steps

### Step 1: Install Dependencies
Run from workspace root:
```bash
npm install
```
This automatically runs `npm install` across root, `backend/`, and `frontend/` workspaces, and generates the Prisma client.

### Step 2: Database Preparation
Before pointing production traffic:
```bash
# Push schema or apply migrations to production PostgreSQL
npx prisma migrate deploy --schema=backend/prisma/schema.prisma
```

### Step 3: Production Build
```bash
npm run build
```
This compiles the React frontend into `frontend/dist/` and runs Prisma code generation.

### Step 4: Deploying to Vercel
Connect your GitHub repository to Vercel or deploy using Vercel CLI:
```bash
vercel --prod
```
Configure:
- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `frontend/dist`

---

## 6. Verification and Health Checks
Verify your deployment with the following endpoints:

| Endpoint | Method | Expected Output | Purpose |
|---|---|---|---|
| `/api/health/live` | `GET` | `{"status":"ok","uptime":...}` | Container/serverless liveness |
| `/api/health/ready` | `GET` | `{"ready":true,"database":{"connected":true}}` | Database connectivity readiness |
| `/api/health/providers` | `GET` | `{"providers":{"gemini":{"configured":true},...}}` | Sanitized AI provider status (no keys leaked) |
| `/api/nonexistent` | `GET` | `{"error":"Not Found","path":"/api/nonexistent"}` (Status 404) | Verifies API returns JSON, not HTML |

---

## 7. Rollback Plan
If an issue occurs in production:
1. **Instant Rollback**: In Vercel Dashboard, go to **Deployments** → Select prior healthy deployment → Click **Promote to Production**.
2. **Database Rollback**: If a database migration was applied destructively:
   - Restore database backup from your provider snapshot.
   - Re-deploy previous commit tagged before the migration.
