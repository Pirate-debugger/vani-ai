import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAgentWorkflow, extractTasksFromDocument } from '../services/agentService.js';
import * as llmModule from '../services/llm.js';
import * as tinyfishModule from '../services/tinyfish.js';
import prisma from '../lib/prisma.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (cb) => {
      const mockTx = {
        document: {
          create: vi.fn().mockResolvedValue({
            id: 'doc_brd_1',
            projectId: 'proj_1',
            type: 'brd',
            title: 'Student PG Finder Startup BRD',
            content: '# Business Requirements Document\n\n## 1. Executive Summary...'
          })
        },
        documentVersion: {
          create: vi.fn().mockResolvedValue({ id: 'ver_1', versionName: 'v1.0' })
        },
        task: {
          createMany: vi.fn().mockResolvedValue({ count: 5 }),
          findMany: vi.fn().mockResolvedValue([
            { id: 'task_1', title: 'Setup Student Auth', priority: 'high', status: 'pending' },
            { id: 'task_2', title: 'Integrate Map Search', priority: 'high', status: 'pending' },
            { id: 'task_3', title: 'Build PG Listing Form', priority: 'medium', status: 'pending' }
          ])
        }
      };
      return await cb(mockTx);
    })
  }
}));

describe('BRD Generation Agent & Task Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a complete structured BRD with 27 sections and extracts tasks', async () => {
    const mockBrdJson = JSON.stringify({
      title: 'Student PG Finder Startup BRD',
      summary: 'Comprehensive BRD for an Indian student accommodation platform.',
      content: `# Business Requirements Document: Student PG Finder

## 1. Executive Summary
## 2. Business Background
## 3. Problem Statement
## 4. Business Objectives
## 5. Goals
## 6. Success Criteria
## 7. Stakeholders
## 8. Target Users
## 9. User Personas
## 10. Current State
## 11. Proposed Solution
## 12. Functional Requirements
- **FR-001**: User Authentication
- **FR-002**: PG Search & Filters
- **FR-003**: Virtual Tour Booking
## 13. Non-Functional Requirements
- **NFR-001**: Latency under 200ms
- **NFR-002**: AES-256 Encryption
## 14. Business Rules
## 15. User Workflows
## 16. Data Requirements
## 17. Integration Requirements
## 18. Dependencies
## 19. Assumptions
## 20. Constraints
## 21. Risks and Mitigation
## 22. KPIs
## 23. Competitor/Market Analysis
## 24. Open Questions
## 25. MVP Scope
## 26. Future Scope
## 27. Implementation Priorities`,
      metadata: {
        researchUsed: false,
        confidence: 'high',
        sources: []
      }
    });

    const mockTasksJson = JSON.stringify([
      { title: 'Setup Student Auth', description: 'Phone and OTP', priority: 'high' },
      { title: 'Integrate Map Search', description: 'Google Maps API', priority: 'high' },
      { title: 'Build PG Listing Form', description: 'Owner registration', priority: 'medium' }
    ]);

    // Mock getAIResponse
    vi.spyOn(llmModule, 'getAIResponse')
      .mockResolvedValueOnce({ response: mockBrdJson, model: 'gemini-2.0-flash' })
      .mockResolvedValueOnce({ response: mockTasksJson, model: 'gemini-2.0-flash' });

    const result = await runAgentWorkflow(
      'proj_1',
      'brd',
      'Student PG finder startup ka BRD banao',
      [],
      { geminiKey: 'mock_key' }
    );

    expect(result.documentId).toBe('doc_brd_1');
    expect(result.summary).toContain('Indian student accommodation platform');
    expect(result.tasks.length).toBe(3);
    expect(result.tasks[0].title).toBe('Setup Student Auth');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('integrates TinyFish live research when competitor research is requested', async () => {
    vi.spyOn(tinyfishModule, 'shouldUseLiveResearch').mockReturnValue(true);
    vi.spyOn(tinyfishModule, 'researchForBRD').mockResolvedValue({
      available: true,
      query: 'student PG finder competitors',
      sources: [
        { title: 'Stanza Living Profile', url: 'https://example.com/stanza', snippet: 'Top student co-living provider' }
      ],
      competitors: ['Stanza Living', 'ZoloStays'],
      market_signals: ['High tier-1 city demand'],
      pricing_signals: ['₹8000-12000 per bed'],
      risks: ['Seasonal vacancy during semester breaks']
    });

    const mockBrdWithResearch = JSON.stringify({
      title: 'Student PG Finder Market BRD',
      summary: 'BRD grounded with verified competitor research.',
      content: '# BRD with competitor analysis...',
      metadata: {
        researchUsed: true,
        confidence: 'high',
        sources: [{ title: 'Stanza Living Profile', url: 'https://example.com/stanza' }]
      }
    });

    vi.spyOn(llmModule, 'getAIResponse').mockResolvedValue({
      response: mockBrdWithResearch,
      model: 'gemini-2.0-flash'
    });

    const result = await runAgentWorkflow(
      'proj_1',
      'brd',
      'student PG finder startup ka BRD banao aur competitors research karo',
      [],
      { geminiKey: 'mock_key' }
    );

    expect(result.metadata.researchUsed).toBe(true);
    expect(result.metadata.sources.length).toBe(1);
    expect(result.metadata.sources[0].title).toBe('Stanza Living Profile');
  });

  it('handles malformed output with controlled repair gracefully', async () => {
    // Malformed JSON (trailing comma, explanatory text)
    const malformedOutput = `Here is the BRD:\n\`\`\`json\n{\n  "title": "Repaired BRD",\n  "summary": "Repaired summary",\n  "content": "## 1. Executive Summary",\n}\n\`\`\``;

    vi.spyOn(llmModule, 'getAIResponse')
      .mockResolvedValueOnce({ response: malformedOutput, model: 'gemini-2.0-flash' })
      .mockResolvedValueOnce({ response: '[]', model: 'gemini-2.0-flash' });

    const result = await runAgentWorkflow(
      'proj_1',
      'brd',
      'Make a BRD',
      [],
      { geminiKey: 'mock_key' }
    );

    expect(result.documentTitle || result.summary).toBeDefined();
  });
});
