import { TinyFish } from '@tiny-fish/sdk';

let clientInstance = null;

/**
 * Checks if TinyFish API Key is configured in backend environment
 */
export const isTinyFishConfigured = () => {
  return Boolean(process.env.TINYFISH_API_KEY && process.env.TINYFISH_API_KEY.trim());
};

/**
 * Returns a cached or new TinyFish client instance
 */
export const getTinyFishClient = () => {
  if (!isTinyFishConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = new TinyFish({
      apiKey: process.env.TINYFISH_API_KEY.trim()
    });
  }
  return clientInstance;
};

/**
 * Safe timeout wrapper for external promises
 */
const withTimeout = (promise, ms = 15000, errorMsg = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

/**
 * Executes a web search via TinyFish Search API
 *
 * @param {string} query - The search query
 * @param {object} [options] - Optional limit and timeout
 * @returns {Promise<{ success: boolean, available: boolean, results: Array<{ title: string, url: string, snippet: string }>, error?: string }>}
 */
export const searchWeb = async (query, options = {}) => {
  if (!query || typeof query !== 'string') {
    return { success: false, available: false, results: [], error: 'Search query is required' };
  }

  const client = getTinyFishClient();
  if (!client) {
    return {
      success: false,
      available: false,
      results: [],
      error: 'TinyFish API is not configured on the server'
    };
  }

  const limit = options.limit || 5;
  const timeoutMs = options.timeoutMs || 15000;

  try {
    console.log(`[TinyFish Search] Querying: "${query}" (limit: ${limit})`);
    const response = await withTimeout(
      client.search.query({ query, limit }),
      timeoutMs,
      `TinyFish search timed out after ${timeoutMs}ms`
    );

    const rawResults = response?.results || response?.data || [];
    const normalized = rawResults.map(item => ({
      title: item.title || item.name || 'Web Source',
      url: item.url || item.link || '',
      snippet: item.snippet || item.description || item.content || ''
    })).filter(r => r.url);

    return {
      success: true,
      available: true,
      results: normalized
    };
  } catch (error) {
    console.error(`[TinyFish Search] Error querying "${query}":`, error.message);
    return {
      success: false,
      available: false,
      results: [],
      error: error.message
    };
  }
};

/**
 * Fetches and extracts clean markdown/text content from a URL via TinyFish Fetch API
 *
 * @param {string} url - Target URL to fetch
 * @param {object} [options]
 */
export const fetchWeb = async (url, options = {}) => {
  if (!url || typeof url !== 'string') {
    return { success: false, available: false, content: null, error: 'URL is required' };
  }

  const client = getTinyFishClient();
  if (!client) {
    return {
      success: false,
      available: false,
      content: null,
      error: 'TinyFish API is not configured on the server'
    };
  }

  const timeoutMs = options.timeoutMs || 20000;

  try {
    console.log(`[TinyFish Fetch] Fetching URL: ${url}`);
    const response = await withTimeout(
      client.fetch.getContents({ urls: [url] }),
      timeoutMs,
      `TinyFish fetch timed out for URL ${url}`
    );

    const result = response?.results?.[0] || response?.[0] || null;
    const content = result?.content || result?.markdown || result?.text || null;

    return {
      success: true,
      available: true,
      url,
      content
    };
  } catch (error) {
    console.error(`[TinyFish Fetch] Error fetching "${url}":`, error.message);
    return {
      success: false,
      available: false,
      url,
      content: null,
      error: error.message
    };
  }
};

/**
 * Runs a browser-based agent goal on a target website
 *
 * @param {string} url - Target website URL
 * @param {string} goal - Goal description for the agent
 * @param {object} [options]
 */
export const runWebAgent = async (url, goal, options = {}) => {
  const client = getTinyFishClient();
  if (!client) {
    return {
      success: false,
      available: false,
      output: null,
      error: 'TinyFish API is not configured on the server'
    };
  }

  const timeoutMs = options.timeoutMs || 45000;

  try {
    console.log(`[TinyFish WebAgent] Running goal on ${url}: "${goal}"`);
    const response = await withTimeout(
      client.agent.run({ url, goal }),
      timeoutMs,
      `TinyFish web agent timed out after ${timeoutMs}ms`
    );

    return {
      success: true,
      available: true,
      output: response?.output || response?.result || response
    };
  } catch (error) {
    console.error(`[TinyFish WebAgent] Error running agent on "${url}":`, error.message);
    return {
      success: false,
      available: false,
      output: null,
      error: error.message
    };
  }
};

/**
 * Intelligent Decision Layer:
 * Determines if a query or agent request requires live web research
 */
export const shouldUseLiveResearch = (prompt, agentType) => {
  if (!prompt || typeof prompt !== 'string') return false;

  // Explicit research agents
  if (['research', 'market_research', 'idea_validation'].includes(agentType)) {
    return true;
  }

  const p = prompt.toLowerCase();

  // Explicit keywords requesting live data, competitors, market, or pricing
  const researchSignals = [
    'competitor', 'competitors', 'pratiyogi',
    'market research', 'market analysis',
    'pricing', 'prices', 'price', 'market price', 'current price', 'latest price',
    'current trend', 'latest trend', 'market size',
    'real-time', 'live research', 'fetch website',
    'search online', 'browse', 'web research',
    'existing startups', 'similar apps', 'alternatives'
  ];

  for (const signal of researchSignals) {
    if (p.includes(signal)) {
      return true;
    }
  }

  return false;
};

/**
 * Normalizes research results into structured intelligence for the BRD Agent
 */
export const normalizeResearchResults = (query, searchResults = []) => {
  const sources = [];
  const competitors = [];
  const marketSignals = [];
  const pricingSignals = [];
  const risks = [];

  for (const item of searchResults) {
    if (!item.url) continue;

    sources.push({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      key_findings: item.snippet ? [item.snippet.substring(0, 180)] : []
    });

    const text = `${item.title} ${item.snippet}`.toLowerCase();

    // Heuristic classification of signals
    if (text.includes('competitor') || text.includes('vs') || text.includes('alternative') || text.includes('platform')) {
      competitors.push(item.title);
    }
    if (text.includes('price') || text.includes('pricing') || text.includes('cost') || text.includes('₹') || text.includes('$')) {
      pricingSignals.push(item.snippet);
    }
    if (text.includes('market') || text.includes('growth') || text.includes('demand') || text.includes('industry')) {
      marketSignals.push(item.snippet);
    }
    if (text.includes('risk') || text.includes('challenge') || text.includes('barrier') || text.includes('problem')) {
      risks.push(item.snippet);
    }
  }

  return {
    query,
    available: sources.length > 0,
    sources,
    competitors: Array.from(new Set(competitors)).slice(0, 5),
    market_signals: marketSignals.slice(0, 4),
    pricing_signals: pricingSignals.slice(0, 3),
    risks: risks.slice(0, 3)
  };
};

/**
 * End-to-end Research Pipeline for BRD Generation
 * Executes targeted search queries, aggregates sources, and normalizes findings.
 */
export const researchForBRD = async (userIdeaOrPrompt) => {
  if (!isTinyFishConfigured()) {
    console.log('[TinyFish Pipeline] TinyFish not configured. Proceeding without live research.');
    return {
      available: false,
      sources: [],
      reason: 'NOT_CONFIGURED',
      note: 'Live web research unavailable because TINYFISH_API_KEY is not configured.'
    };
  }

  try {
    console.log(`[TinyFish Pipeline] Beginning research for: "${userIdeaOrPrompt.substring(0, 50)}..."`);

    // Formulate 1-2 focused queries from the user's idea
    const cleanPrompt = userIdeaOrPrompt.replace(/[^\w\s]/gi, ' ').trim();
    const primaryQuery = `${cleanPrompt} competitors market India`.substring(0, 100);

    const searchRes = await searchWeb(primaryQuery, { limit: 4, timeoutMs: 12000 });

    if (!searchRes.success || searchRes.results.length === 0) {
      console.log('[TinyFish Pipeline] Search yielded no results or timed out.');
      return {
        available: false,
        sources: [],
        reason: searchRes.error || 'NO_RESULTS',
        note: 'Live web research could not find matching sources.'
      };
    }

    const normalized = normalizeResearchResults(primaryQuery, searchRes.results);
    console.log(`[TinyFish Pipeline] Successfully found ${normalized.sources.length} sources.`);
    return normalized;

  } catch (err) {
    console.error('[TinyFish Pipeline] Research error (non-fatal):', err.message);
    return {
      available: false,
      sources: [],
      reason: 'FAILED',
      note: 'Live web research encountered an error. Proceeding with internal knowledge.'
    };
  }
};
