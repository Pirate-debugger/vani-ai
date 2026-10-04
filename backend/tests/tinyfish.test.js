import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTinyFishConfigured,
  searchWeb,
  fetchWeb,
  runWebAgent,
  shouldUseLiveResearch,
  normalizeResearchResults,
  researchForBRD
} from '../services/tinyfish.js';

// Mock the @tiny-fish/sdk module
vi.mock('@tiny-fish/sdk', () => {
  class MockTinyFish {
    constructor() {
      this.search = {
        query: vi.fn().mockResolvedValue({
          results: [
            {
              title: 'Stanza Living Competitor Profile',
              url: 'https://example.com/stanza',
              snippet: 'Leading student accommodation provider in India with pricing starting at ₹8,000/month.'
            },
            {
              title: 'ZoloStays Market Analysis',
              url: 'https://example.com/zolo',
              snippet: 'Co-living space platform catering to students and young working professionals.'
            }
          ]
        })
      };
      this.fetch = {
        getContents: vi.fn().mockResolvedValue({
          results: [
            {
              url: 'https://example.com/stanza',
              content: '# Stanza Living Overview\nDetailed amenities, student meal plans, and security.'
            }
          ]
        })
      };
      this.agent = {
        run: vi.fn().mockResolvedValue({
          output: 'Found 12 PG listings in Kothrud, Pune with prices between ₹6,000 and ₹12,000.'
        })
      };
    }
  }

  return { TinyFish: MockTinyFish };
});

describe('TinyFish Integration Service', () => {
  const originalKey = process.env.TINYFISH_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TINYFISH_API_KEY = 'test_tinyfish_key_12345';
  });

  afterEach(() => {
    process.env.TINYFISH_API_KEY = originalKey;
  });

  it('detects when TinyFish is configured', () => {
    expect(isTinyFishConfigured()).toBe(true);
    delete process.env.TINYFISH_API_KEY;
    expect(isTinyFishConfigured()).toBe(false);
  });

  it('searchWeb returns normalized search results', async () => {
    const res = await searchWeb('student PG in Pune');
    expect(res.success).toBe(true);
    expect(res.available).toBe(true);
    expect(res.results.length).toBe(2);
    expect(res.results[0].title).toContain('Stanza Living');
    expect(res.results[0].url).toBe('https://example.com/stanza');
  });

  it('fetchWeb retrieves clean page content', async () => {
    const res = await fetchWeb('https://example.com/stanza');
    expect(res.success).toBe(true);
    expect(res.content).toContain('Stanza Living Overview');
  });

  it('runWebAgent executes browser agent goal', async () => {
    const res = await runWebAgent('https://example.com', 'Find price list');
    expect(res.success).toBe(true);
    expect(res.output).toContain('Found 12 PG listings');
  });

  it('smart routing accurately detects queries needing live research', () => {
    expect(shouldUseLiveResearch('student PG finder startup ka BRD banao aur competitors research karo', 'brd')).toBe(true);
    expect(shouldUseLiveResearch('show me latest market prices for co-living', 'general')).toBe(true);
    expect(shouldUseLiveResearch('what are the competitors for my app?', 'general')).toBe(true);
    expect(shouldUseLiveResearch('deep research on Indian edtech', 'research')).toBe(true);
    
    // Casual conversation / static knowledge should NOT trigger live research
    expect(shouldUseLiveResearch('hello Vani how are you', 'general')).toBe(false);
    expect(shouldUseLiveResearch('explain binary search in javascript', 'general')).toBe(false);
  });

  it('normalizes research results into structured intelligence with competitors and pricing', () => {
    const rawItems = [
      {
        title: 'Competitor Stanza Living',
        url: 'https://stanzaliving.com',
        snippet: 'Prices start at ₹9000 with high student market demand'
      }
    ];
    const normalized = normalizeResearchResults('student PG', rawItems);
    expect(normalized.available).toBe(true);
    expect(normalized.sources.length).toBe(1);
    expect(normalized.competitors.length).toBe(1);
    expect(normalized.pricing_signals.length).toBe(1);
  });

  it('researchForBRD gracefully returns unavailable if key is missing without crashing', async () => {
    delete process.env.TINYFISH_API_KEY;
    const res = await researchForBRD('student PG finder');
    expect(res.available).toBe(false);
    expect(res.sources.length).toBe(0);
    expect(res.reason).toBe('NOT_CONFIGURED');
  });
});
