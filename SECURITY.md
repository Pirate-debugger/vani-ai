# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

Security is paramount for Vani AI. If you discover a security vulnerability or weakness within this codebase:

1. **Do not create a public GitHub issue.**
2. Email our security team directly at `security@vani.ai` or submit a private security advisory through GitHub.
3. Include detailed steps to reproduce the issue, proof of concept, and affected endpoints.
4. We acknowledge reports within 24 hours and aim to resolve critical vulnerabilities within 72 hours.

## Security Baseline Standards

- **Authentication & RBAC**: Every cost-bearing route (`/api/ai/*`, `/api/voice/*`) requires session authentication or strictly rate-limited isolated guest credentials. Project access requires verified project ownership (`userId === project.userId`).
- **Data Protection**: API keys stored in the database are encrypted at rest using AES-256-GCM with versioned key rotation (`v1:<iv>:<tag>:<encrypted>`).
- **Prompt Injection Defense**: Untrusted external web content fetched via live research is encapsulated in `<UNTRUSTED_WEB_RESEARCH_DATA>` blocks and strictly quarantined from executing system commands.
- **CSRF & CORS**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require cross-origin verification. Blanket wildcard origins are prohibited.
