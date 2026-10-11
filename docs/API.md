# Vani AI — API Reference (OpenAPI 3.1)

Base URL: `http://localhost:5000/api` (Production: configured via `FRONTEND_URL` / reverse proxy)

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register`
Register a new local account.
- **Request Body**:
  ```json
  {
    "name": "Jane Founder",
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": { "id": "usr_123", "name": "Jane Founder", "email": "jane@example.com", "provider": "local", "isGuest": false }
  }
  ```

### `POST /api/auth/login`
Authenticate using email and password. Session ID is regenerated upon authentication.
- **Request Body**:
  ```json
  { "email": "jane@example.com", "password": "SecurePassword123!" }
  ```
- **Response**: `200 OK`
  ```json
  {
    "user": { "id": "usr_123", "name": "Jane Founder", "email": "jane@example.com", "provider": "local", "isGuest": false }
  }
  ```

### `GET /api/auth/me`
Retrieve active authenticated user profile.
- **Response**: `200 OK` or `401 Unauthorized`

### `POST /api/auth/logout`
Terminate active session.
- **Response**: `200 OK`

---

## 2. AI & Orchestration (`/api/ai`)

### `POST /api/ai/chat`
Execute an interactive chat query with dynamic agent routing.
- **Request Body**:
  ```json
  {
    "message": "Create a BRD for an EV battery swap network in Pune",
    "projectId": "proj_123",
    "language": "hi-IN",
    "stream": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "reply": "Here is the comprehensive BRD for the EV battery swap network...",
    "agent": "brd",
    "requestId": "req_abc123",
    "citations": []
  }
  ```

### `POST /api/ai/agent/execute`
Directly invoke a specific agent from the 26 registered agents.
- **Request Body**:
  ```json
  {
    "agentId": "pitch_deck",
    "prompt": "Pitch deck outline for a B2B SaaS for Kirana stores",
    "projectId": "proj_123"
  }
  ```

### `GET /api/ai/session/:sessionId/state`
Retrieve persistent session state. Enforces strict ownership checks (returns `404 Not Found` if user does not own session).

---

## 3. Documents & Critic Auditor (`/api/document`)

### `GET /api/document/:id`
Fetch document details with version history.

### `PUT /api/document/:id`
Update document title or markdown content.

### `POST /api/document/:id/audit`
Run the **Reviewer / Critic Engine** against a stored document.
- **Response**: `200 OK`
  ```json
  {
    "score": 92,
    "critique": {
      "completeness": "All 29 enterprise sections present with granular requirements.",
      "consistency": "FR-001 aligns directly with NFR-004 latency requirements.",
      "indianContextGaps": "UPI auto-pay regulations and RBI mandate compliance should be detailed.",
      "unsupportedClaims": "Claim regarding 99.999% uptime requires redundancy specs.",
      "actionableSuggestions": [
        "Include fallback offline PIN authentication for rural network drops."
      ]
    }
  }
  ```

---

## 4. Voice Pipeline (`/api/voice`)

### `POST /api/voice/bridge`
Process voice audio payload via Sarvam Saaras v4 STT, execute prompt, and return Sarvam Bulbul v3 TTS synthesis.
- **Request Body**:
  ```json
  {
    "audioBase64": "<base64_wav_data>",
    "language": "hi-IN",
    "projectId": "proj_123"
  }
  ```

---

## 5. Integrations & MCP (`/api/integration`)

### `POST /api/integration/github/sync`
Synchronize project tasks directly to a GitHub repository's issues.
- **Request Body**:
  ```json
  {
    "projectId": "proj_123",
    "githubRepo": "owner/repo",
    "githubToken": "ghp_xxxxxxxxxxxx"
  }
  ```

### `POST /api/integration/slack/alert`
Send formatted alerts and updates to a Slack incoming webhook.

### `POST /api/integration/mcp/invoke`
Execute an MCP tool via Model Context Protocol client.
- **Request Body**:
  ```json
  {
    "serverName": "custom_tools",
    "toolName": "calculate_roi",
    "arguments": { "revenue": 1000000, "cost": 400000 }
  }
  ```

---

## 6. Temporal Actions & Scheduler (`/api/scheduler`)

### `GET /api/scheduler`
List user's scheduled jobs (competitor watch, recurring reminders, automated research).

### `POST /api/scheduler`
Create a new scheduled action or competitor page watcher.
- **Request Body**:
  ```json
  {
    "actionType": "competitor_watch",
    "name": "Track Stanza Living Pricing",
    "target": "https://example.com/pricing",
    "cronExpression": "0 8 * * *",
    "projectId": "proj_123"
  }
  ```

---

## 7. Health & Observability (`/api/health`)

### `GET /api/health/live`
Container liveness probe.
- **Response**: `{"status": "ok", "uptime": 120}`

### `GET /api/health/ready`
Database readiness probe.
- **Response**: `{"status": "ready", "database": "connected"}`

### `GET /api/health`
Full system health inspection, database metrics, and configured AI provider status.
