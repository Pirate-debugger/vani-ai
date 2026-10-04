import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrate } from '../services/orchestrator.js';
import * as llmModule from '../services/llm.js';
import * as tinyfishModule from '../services/tinyfish.js';
import prisma from '../lib/prisma.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (cb) => {
      const mockTx = {
        document: {
          create: vi.fn().mockResolvedValue({
            id: 'doc_orch_1',
            projectId: 'proj_test_1',
            type: 'brd',
            title: 'Orchestrated BRD',
            content: '# Business Requirements Document'
          })
        },
        documentVersion: {
          create: vi.fn().mockResolvedValue({ id: 'ver_orch_1' })
        },
        task: {
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
          findMany: vi.fn().mockResolvedValue([
            { id: 't1', title: 'Task 1', priority: 'high' },
            { id: 't2', title: 'Task 2', priority: 'medium' }
          ])
        }
      };
      return await cb(mockTx);
    })
  }
}));

describe('Master AI Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates BRD request emitting real-time agent and tool events', async () => {
    const emittedEvents = [];
    const onEvent = (ev) => emittedEvents.push(ev);

    vi.spyOn(tinyfishModule, 'researchForBRD').mockResolvedValue({
      available: true,
      query: 'student PG finder competitors',
      sources: [
        { title: 'Stanza Living Analysis', url: 'https://example.com/stanza', snippet: 'Leading student PG in Pune.' }
      ],
      competitors: ['Stanza Living', 'Zolo Stays'],
      market_signals: ['Rising student demand'],
      pricing_signals: ['Rs 8000-15000/mo'],
      risks: ['High deposit expectations']
    });

    const mockBrdJson = JSON.stringify({
      title: 'Student Housing Startup BRD',
      summary: 'Verified structured BRD for student housing.',
      content: '# 1. Executive Summary\nStudent housing platform\n\n## 12. Functional Requirements\n- **FR-001**: Auth\n- **FR-002**: Search',
      metadata: { researchUsed: true, confidence: 'high' }
    });

    vi.spyOn(llmModule, 'getAIResponse').mockResolvedValue({
      response: mockBrdJson,
      model: 'gemini-3.5-flash',
      simulated: false
    });

    const result = await orchestrate({
      prompt: 'Vani, student PG finder startup ka detailed BRD banao aur current competitors research karo.',
      agentType: 'brd',
      projectId: 'proj_test_1',
      apiKeys: { geminiKey: 'mock-gemini-key', tinyfishKey: 'mock-tf-key' },
      onEvent
    });

    expect(result).toBeDefined();
    expect(result.title).toBe('Student Housing Startup BRD');
    expect(result.documentId).toBe('doc_orch_1');
    expect(result.agentExecution).toBeDefined();
    expect(result.agentExecution.agent).toBe('brd');
    expect(result.agentExecution.providersUsed).toContain('gemini-3.5-flash');

    // Verify event progression
    const eventTypes = emittedEvents.map(e => e.type);
    expect(eventTypes).toContain('agent.started');
    expect(eventTypes).toContain('tool.started');
    expect(eventTypes).toContain('tool.completed');
    expect(eventTypes).toContain('agent.step');
    expect(eventTypes).toContain('agent.completed');
  });

  it('delegates general chat queries without heavy document pipeline', async () => {
    const emittedEvents = [];
    const onEvent = (ev) => emittedEvents.push(ev);

    vi.spyOn(llmModule, 'getAIResponse').mockResolvedValue({
      response: 'Namaste! Main Vani AI hoon.',
      model: 'sarvam-105b-conversations',
      simulated: false
    });

    const result = await orchestrate({
      prompt: 'Hello Vani, how are you?',
      agentType: 'general',
      apiKeys: { sarvamKey: 'mock-sarvam-key' },
      onEvent
    });

    expect(result.response).toBe('Namaste! Main Vani AI hoon.');
    expect(result.agentExecution.agent).toBe('general');
    expect(emittedEvents.some(e => e.type === 'agent.completed')).toBe(true);
  });
});
