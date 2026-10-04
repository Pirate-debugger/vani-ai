import { describe, it, expect } from 'vitest';
import { parseStructuredJSON, validateAndNormalizeBRD, validateAndNormalizeTasks } from '../lib/jsonParser.js';

describe('JSON Parser & Sanitizer', () => {
  it('parses pure valid JSON', () => {
    const raw = '{"title": "Test Title", "summary": "Test Summary"}';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Test Title');
  });

  it('parses markdown fenced json', () => {
    const raw = '```json\n{"title": "Fenced Title", "count": 10}\n```';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Fenced Title');
    expect(result.count).toBe(10);
  });

  it('parses json with commentary before and after', () => {
    const raw = 'Here is the BRD you requested:\n```json\n{\n  "title": "Wrapped Title",\n  "summary": "Nice"\n}\n```\nLet me know if you need more details.';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Wrapped Title');
  });

  it('repairs trailing commas in objects and arrays', () => {
    const raw = '{\n  "title": "Trailing",\n  "items": [1, 2, ],\n}';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Trailing');
    expect(result.items).toEqual([1, 2]);
  });

  it('repairs unescaped literal newlines inside string literals', () => {
    const raw = '{\n  "title": "Raw Newlines",\n  "content": "Line 1\nLine 2\nLine 3"\n}';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Raw Newlines');
    expect(result.content).toBe('Line 1\nLine 2\nLine 3');
  });

  it('repairs truncated JSON by closing open structures', () => {
    const raw = '{\n  "title": "Truncated Doc",\n  "content": "Incomplete text';
    const result = parseStructuredJSON(raw);
    expect(result.title).toBe('Truncated Doc');
    expect(result.content).toContain('Incomplete text');
  });

  it('throws on completely invalid unparseable text', () => {
    expect(() => parseStructuredJSON('Just plain conversational text without any JSON structure.'))
      .toThrow(/Failed to parse structured JSON/);
  });
});

describe('BRD Schema Validation & Normalization', () => {
  it('validates and normalizes complete BRD', () => {
    const input = {
      title: 'PG Finder BRD',
      summary: 'Executive summary for student PG finder app.',
      content: '## 1. Executive Summary\n\nContent here...',
      metadata: {
        researchUsed: true,
        confidence: 'high',
        sources: [{ title: 'Source 1', url: 'https://example.com' }]
      }
    };

    const brd = validateAndNormalizeBRD(input);
    expect(brd.title).toBe('PG Finder BRD');
    expect(brd.summary).toBe('Executive summary for student PG finder app.');
    expect(brd.metadata.researchUsed).toBe(true);
    expect(brd.metadata.sources.length).toBe(1);
  });

  it('provides safe fallbacks for missing BRD fields', () => {
    const input = {
      content: '## 1. Executive Summary\n\nDirect content without explicit summary or metadata.'
    };

    const brd = validateAndNormalizeBRD(input);
    expect(brd.title).toBe('Business Requirements Document');
    expect(brd.summary).toBeDefined();
    expect(brd.metadata.researchUsed).toBe(false);
    expect(brd.metadata.confidence).toBe('high');
  });
});

describe('Task Validation & Deduplication', () => {
  it('normalizes task items and deduplicates identical titles', () => {
    const tasks = [
      { title: 'Setup Database', description: 'Postgres or SQLite', priority: 'high' },
      { title: 'setup database', description: 'Duplicate with lower case', priority: 'high' },
      { title: 'Create Auth API', priority: 'INVALID_PRIORITY' },
      { title: '   ' } // Invalid empty title
    ];

    const result = validateAndNormalizeTasks(tasks);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Setup Database');
    expect(result[0].priority).toBe('high');
    expect(result[1].title).toBe('Create Auth API');
    expect(result[1].priority).toBe('medium'); // Defaulted from invalid
  });
});
