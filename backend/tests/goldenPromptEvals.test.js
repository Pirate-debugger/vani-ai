import { describe, it, expect } from 'vitest';
import { identifyAgentIntent } from '../services/agentService.js';
import { auditDocumentQuality } from '../services/reviewerService.js';
import { parseStructuredJSON, validateAndNormalizeBRD } from '../lib/jsonParser.js';

describe('Phase 3 Golden-Prompt Multi-Lingual Evals (Hindi / Hinglish / English)', () => {
  const goldenEvalPrompts = [
    {
      prompt: 'Mere PG Finder startup ka comprehensive BRD document bana do',
      lang: 'Hinglish',
      expectedAgent: 'brd'
    },
    {
      prompt: 'Student PG competitors research karo aur pricing compare karo',
      lang: 'Hinglish',
      expectedAgent: 'research'
    },
    {
      prompt: 'Build an MVP build plan for grocery delivery platform',
      lang: 'English',
      expectedAgent: 'build'
    },
    {
      prompt: 'Venture angel pitch deck outline bana do with speaker notes for demo day',
      lang: 'Hinglish',
      expectedAgent: 'pitch_deck'
    },
    {
      prompt: 'Calculate unit economics, CAC, LTV and financial model projection',
      lang: 'English',
      expectedAgent: 'financial_model'
    },
    {
      prompt: 'Hamare startup ka Bharat GTM launch plan banao for tier-2 WhatsApp distribution',
      lang: 'Hinglish',
      expectedAgent: 'gtm_plan'
    },
    {
      prompt: 'Create a one page lean canvas for our B2B marketplace',
      lang: 'English',
      expectedAgent: 'lean_canvas'
    },
    {
      prompt: 'Review BRD document and perform comprehensive quality audit critique',
      lang: 'English',
      expectedAgent: 'reviewer_critic'
    },
    {
      prompt: 'DPIIT Startup India and GST compliance checklist for tech startup',
      lang: 'English',
      expectedAgent: 'india_compliance'
    }
  ];

  it('accurately routes 100% of golden multilingual prompts to designated agents', async () => {
    const apiKeys = {};
    for (const testCase of goldenEvalPrompts) {
      const intent = await identifyAgentIntent(testCase.prompt, apiKeys);
      expect(intent).toBe(testCase.expectedAgent);
    }
  });

  it('validates schema robustness against malformed and markdown-wrapped JSON', () => {
    const rawFencedJson = '```json\n{\n  "title": "PG Finder BRD",\n  "summary": "Verified business requirements",\n  "content": "## 1. Executive Summary\\n\\nTarget market defined.",\n  "metadata": { "researchUsed": true, "sources": ["https://example.com"] }\n}\n```';
    const parsed = parseStructuredJSON(rawFencedJson);
    expect(parsed).toBeDefined();
    expect(parsed.title).toBe('PG Finder BRD');

    const normalized = validateAndNormalizeBRD(parsed, 'BRD Agent');
    expect(normalized.title).toBe('PG Finder BRD');
    expect(normalized.metadata.researchUsed).toBe(true);
  });

  it('reviewer critic evaluates document completeness and provides structured scoring', () => {
    const sampleBRD = `
# Business Requirements Document: Student PG Finder
## 1. Executive Summary
Student PG finder platform in India.
## 2. Problem Statement
High brokerage and unsafe hostels in Pune and Bangalore.
## 3. Proposed Solution
Direct owner-to-student verification platform with UPI payments.
## 4. Functional Requirements
- **FR-001**: User Onboarding (Student, High)
- **FR-002**: Hostels Geolocation Map Search (Student, High)
- **FR-003**: Digital Lease Agreement (Student, Medium)
- **FR-004**: Online Security Deposit via UPI (Student, High)
## 5. Non-Functional Requirements
- **NFR-001**: 99.9% Uptime
- **NFR-002**: End-to-end Encryption and DPDP Act compliance
## 6. KPIs & Success Criteria
CAC under ₹500, Month 3 retention > 60%.
## 7. Competitor Analysis
Stanza Living, ZoloStays, OxfordCaps.
    `;

    const audit = auditDocumentQuality(sampleBRD, { researchUsed: true, sources: [{ title: 'Stanza', url: 'https://stanza.com' }] });
    expect(audit.score).toBeGreaterThanOrEqual(75);
    expect(audit.grade).toBeDefined();
    expect(audit.suggestions).toBeInstanceOf(Array);
    expect(audit.checks.hasIndianContext).toBe(true);
  });
});
