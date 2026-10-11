import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import mcpClient from '../services/mcpClient.js';
import { auditDocumentQuality } from '../services/reviewerService.js';

describe('Phase 3 Integrations, MCP Client & Document Auditor', () => {
  describe('Integrations Status Endpoint', () => {
    it('GET /api/integrations/status returns comprehensive provider & integration status without leaking secrets', async () => {
      const res = await request(app).get('/api/integrations/status');
      expect(res.status).toBe(200);
      expect(res.body.github).toBeDefined();
      expect(res.body.github.status).toBe('AVAILABLE');
      expect(res.body.notion).toBeDefined();
      expect(res.body.mcp).toBeDefined();
      expect(res.body.mcp.status).toBe('AVAILABLE');
      expect(res.body.sarvam).toBeDefined();
      expect(res.body.gemini).toBeDefined();

      // Ensure no raw keys are ever exposed
      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('AIza');
      expect(jsonStr).not.toContain('sk-');
    });
  });

  describe('Model Context Protocol (MCP) Client', () => {
    it('registers and lists external MCP server endpoints', () => {
      const serverId = `test_mcp_${Date.now()}`;
      mcpClient.registerServer(serverId, {
        url: 'http://localhost:8080',
        name: 'Local Test MCP Sidecar'
      });

      const servers = mcpClient.listServers();
      const registered = servers.find(s => s.id === serverId);
      expect(registered).toBeDefined();
      expect(registered.name).toBe('Local Test MCP Sidecar');
      expect(registered.url).toBe('http://localhost:8080');
    });

    it('gracefully handles unavailable MCP server connections without process crash', async () => {
      const fakeServerId = `nonexistent_mcp_${Date.now()}`;
      mcpClient.registerServer(fakeServerId, {
        url: 'http://localhost:59999',
        name: 'Offline Server'
      });

      const tools = await mcpClient.listTools(fakeServerId);
      expect(tools).toEqual([]);
    });
  });

  describe('Reviewer & Critic Service', () => {
    it('correctly scores an incomplete draft document lower and suggests fixes', () => {
      const bareDraft = 'A student app for finding rooms.';
      const audit = auditDocumentQuality(bareDraft);

      expect(audit.score).toBeLessThan(50);
      expect(audit.grade).toBe('Needs Improvement');
      expect(audit.suggestions.length).toBeGreaterThan(0);
      expect(audit.suggestions.some(s => s.area === 'Functional Requirements')).toBe(true);
    });

    it('scores a comprehensive BRD with FRs, NFRs, and Indian context higher', () => {
      const detailedBRD = `
# Business Requirements Document: Kirana B2B Platform
## 1. Executive Summary
Empowering local Kirana store owners across India with digital inventory.
## 2. Problem Statement
Stockouts and high procurement costs in tier-2 cities.
## 3. Proposed Solution
Direct FMCG distributor network with UPI AutoPay financing.
## 4. Functional Requirements
- **FR-001**: Store Verification via GSTIN and Udyam MSME (Retailer, High)
- **FR-002**: Daily Replenishment Catalog (Retailer, High)
- **FR-003**: 24-Hour Delivery Dispatch (System, High)
- **FR-004**: Instant UPI Payment on Delivery (Retailer, High)
- **FR-005**: Digital Khata Ledger (Retailer, Medium)
## 5. Non-Functional Requirements
- **NFR-001**: DPDP Act 2023 compliance & encrypted transaction logs
- **NFR-002**: Sub-500ms API response time on 4G networks
- **NFR-003**: 99.95% Availability SLA
## 6. KPIs & Success Criteria
Gross merchandise value, 40% repeat order rate, CAC < ₹300.
## 7. Competitor Analysis
Udaan, Jumbotail, ElasticRun.
      `;

      const audit = auditDocumentQuality(detailedBRD, { researchUsed: true, sources: [{ title: 'FMCG report', url: 'https://example.com' }] });
      expect(audit.score).toBeGreaterThanOrEqual(85);
      expect(audit.checks.hasIndianContext).toBe(true);
      expect(audit.checks.hasFunctionalRequirements).toBe(true);
    });
  });
});
