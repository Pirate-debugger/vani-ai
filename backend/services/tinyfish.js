import { TinyFish } from '@tiny-fish/sdk';

let clientInstance = null;

/**
 * Checks if TinyFish API Key is configured in backend environment or passed key
 */
export const isTinyFishConfigured = (overrideKey) => {
  const key = overrideKey || process.env.TINYFISH_API_KEY;
  return Boolean(key && key.trim());
};

/**
 * Returns a cached or new TinyFish client instance
 */
export const getTinyFishClient = (overrideKey) => {
  const key = (overrideKey || process.env.TINYFISH_API_KEY || '').trim();
  if (!key) return null;
  if (!clientInstance || overrideKey) {
    const client = new TinyFish({ apiKey: key });
    if (!overrideKey) clientInstance = client;
    return client;
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

function extractDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Executes a web search via TinyFish Search API
 */
export const searchWeb = async (query, options = {}) => {
  if (!query || typeof query !== 'string') {
    return { success: false, available: false, results: [], error: 'Search query is required' };
  }

  const apiKey = options.apiKey || options.tinyfishKey;
  const client = getTinyFishClient(apiKey);
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
    
    let response;
    if (typeof client.search?.query === 'function') {
      response = await withTimeout(
        client.search.query({ query }),
        timeoutMs,
        `TinyFish search timed out after ${timeoutMs}ms`
      );
    } else if (typeof client.search === 'function') {
      response = await withTimeout(
        client.search({ query, limit }),
        timeoutMs,
        `TinyFish search timed out after ${timeoutMs}ms`
      );
    }

    const rawResults = response?.results || response?.items || response?.data || response || [];
    const normalized = (Array.isArray(rawResults) ? rawResults : [])
      .slice(0, limit)
      .map(item => ({
        title: item.title || item.name || 'Web Source',
        url: item.url || item.link || '',
        snippet: item.snippet || item.description || item.content || '',
        domain: extractDomain(item.url || item.link || '')
      }))
      .filter(r => r.url && (r.url.startsWith('http://') || r.url.startsWith('https://')));

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
 */
export const fetchWeb = async (url, options = {}) => {
  if (!url || typeof url !== 'string') {
    return { success: false, available: false, content: null, error: 'URL is required' };
  }

  const apiKey = options.apiKey || options.tinyfishKey;
  const client = getTinyFishClient(apiKey);
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
    let response;
    if (typeof client.fetch?.getContents === 'function') {
      response = await withTimeout(
        client.fetch.getContents({ urls: [url], format: 'markdown' }),
        timeoutMs,
        `TinyFish fetch timed out for URL ${url}`
      );
    } else if (typeof client.fetch === 'function') {
      response = await withTimeout(
        client.fetch({ url, format: 'markdown' }),
        timeoutMs,
        `TinyFish fetch timed out for URL ${url}`
      );
    }

    const result = response?.results?.[0] || response?.[0] || response || null;
    const content = result?.content || result?.markdown || result?.text || null;

    return {
      success: true,
      available: true,
      url,
      content,
      domain: extractDomain(url)
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
 */
export const runWebAgent = async (url, goal, options = {}) => {
  const apiKey = options.apiKey || options.tinyfishKey;
  const client = getTinyFishClient(apiKey);
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
    let response;
    if (typeof client.agent?.run === 'function') {
      response = await withTimeout(
        client.agent.run({ url, goal }),
        timeoutMs,
        `TinyFish web agent timed out after ${timeoutMs}ms`
      );
    } else if (typeof client.agent === 'function') {
      response = await withTimeout(
        client.agent({ url, goal }),
        timeoutMs,
        `TinyFish web agent timed out after ${timeoutMs}ms`
      );
    }

    return {
      success: true,
      available: true,
      output: response?.output || response?.result || response?.summary || response
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
 * Determines whether request requires live web research
 */
export const shouldUseLiveResearch = (prompt, agentType) => {
  if (!prompt || typeof prompt !== 'string') return false;

  if (['research', 'market_research', 'idea_validation'].includes(agentType)) {
    return true;
  }

  const p = prompt.toLowerCase();

  // Negative overrides (simple concepts, definitions, direct programming)
  const nonResearchSignals = [
    'explain recursion', 'explain normalization', 'what is sql', 'write a python loop',
    'hello', 'namaste', 'kaise ho', 'who are you', 'how do i', 'what is a function'
  ];
  for (const neg of nonResearchSignals) {
    if (p.includes(neg) && !p.includes('competitor') && !p.includes('market') && !p.includes('price')) {
      return false;
    }
  }

  const researchSignals = [
    'competitor', 'competitors', 'pratiyogi',
    'market research', 'market analysis', 'market size',
    'pricing', 'prices', 'current price', 'latest price',
    'compare', 'comparison', 'current trend', 'latest trend',
    'real-time', 'live research', 'search online', 'browse web',
    'web research', 'existing startups', 'alternatives'
  ];

  return researchSignals.some(signal => p.includes(signal));
};

/**
 * Normalizes research results into structured intelligence for the BRD Agent and Research Agent
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
      domain: item.domain || extractDomain(item.url),
      key_findings: item.snippet ? [item.snippet.substring(0, 180)] : []
    });

    const text = `${item.title} ${item.snippet}`.toLowerCase();
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
 * Evaluates and ranks search results based on query relevance, domain authority, and informativeness
 */
export const rankSearchResults = (results = [], userPrompt = '') => {
  if (!Array.isArray(results) || results.length === 0) return [];
  const promptTokens = (userPrompt || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const authoritativeDomains = [
    'inc42.com', 'yourstory.com', 'techcrunch.com', 'economictimes.indiatimes.com',
    'livemint.com', 'forbes.com', 'crunchbase.com', 'github.com', 'ycombinator.com'
  ];

  const scored = results.map(item => {
    let score = 0;
    const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    const domain = (item.domain || extractDomain(item.url) || '').toLowerCase();

    // 1. Keyword density match
    for (const token of promptTokens) {
      if ((item.title || '').toLowerCase().includes(token)) score += 3;
      if ((item.snippet || '').toLowerCase().includes(token)) score += 1.5;
    }

    // 2. Domain authority bonus
    if (authoritativeDomains.some(d => domain.includes(d))) {
      score += 4;
    }

    // 3. Quantitative signals (pricing, metrics, statistics)
    if (/[₹$€%]|price|pricing|cost|market|competitor|growth/i.test(text)) {
      score += 2;
    }

    // 4. Content length penalty for empty or stub snippets
    if (!item.snippet || item.snippet.length < 30) {
      score -= 3;
    }

    return { item, score };
  });

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by root domain to avoid 3 results from the exact same site
  const seenDomains = new Map();
  const ranked = [];

  for (const { item } of scored) {
    const domain = item.domain || extractDomain(item.url);
    const domainCount = seenDomains.get(domain) || 0;
    if (domainCount < 2) {
      seenDomains.set(domain, domainCount + 1);
      ranked.push(item);
    }
  }

  return ranked;
};

/**
 * Constructs structured evidence objects with realistic confidence scoring
 * Signals: High, Medium, Needs Verification
 */
export const extractEvidenceObjects = (sourcesWithContent = []) => {
  const evidenceList = [];

  sourcesWithContent.forEach((src, idx) => {
    if (!src.url) return;
    const textSnippet = src.content ? src.content.substring(0, 450).replace(/\s+/g, ' ') : src.snippet;
    if (!textSnippet || textSnippet.length < 15) return;

    const hasNumbers = /[₹$€\d+%]|pricing|competitor|growth|revenue/i.test(textSnippet);
    const hasDeepContent = Boolean(src.content && src.content.length > 200);

    let confidence = 'Medium';
    let confidenceReason = 'Snippet evidence indexed from primary web source.';

    if (hasDeepContent && hasNumbers) {
      confidence = 'High';
      confidenceReason = 'Verified from full page fetch with concrete domain signals and metrics.';
    } else if (!hasNumbers || textSnippet.length < 60 || idx > 2) {
      confidence = 'Needs Verification';
      confidenceReason = 'Secondary snippet or unconfirmed claim requiring independent validation.';
    }

    evidenceList.push({
      claim: `Market finding from ${src.title || src.domain || 'web source'}`,
      evidence: textSnippet,
      source: src.title || src.domain || src.url,
      url: src.url,
      confidence,
      confidenceReason
    });
  });

  return evidenceList;
};

/**
 * End-to-end Focused Research Pipeline
 * Pipeline:
 * Research Questions -> TinyFish Search -> Rank Results -> TinyFish Fetch -> Extract Evidence -> Grounded Output
 */
export const executeResearchPipeline = async (userIdeaOrPrompt, options = {}) => {
  const apiKey = options.apiKey || options.tinyfishKey;
  if (!isTinyFishConfigured(apiKey)) {
    console.log('[TinyFish Pipeline] TinyFish not configured. Proceeding without live research.');
    return {
      available: false,
      sources: [],
      evidence: [],
      reason: 'NOT_CONFIGURED',
      note: 'Live web research unavailable because TINYFISH_API_KEY is not configured.'
    };
  }

  try {
    console.log(`[TinyFish Pipeline] Beginning research for: "${userIdeaOrPrompt.substring(0, 60)}..."`);

    const cleanPrompt = userIdeaOrPrompt.replace(/[^\w\s]/gi, ' ').trim();
    
    // Multiple focused research questions (competitors, pricing/monetization, market trends)
    const queries = [
      `${cleanPrompt} competitors platform alternatives India`.substring(0, 90),
      `${cleanPrompt} pricing business model monetization`.substring(0, 90),
      `${cleanPrompt} market analysis challenges pain points`.substring(0, 90)
    ];

    const allResults = [];
    const seenUrls = new Set();

    for (const q of queries) {
      const searchRes = await searchWeb(q, { limit: 4, timeoutMs: 12000, apiKey });
      if (searchRes.success && searchRes.results.length > 0) {
        for (const item of searchRes.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allResults.push(item);
          }
        }
      }
    }

    if (allResults.length === 0) {
      return {
        available: false,
        sources: [],
        evidence: [],
        reason: 'NO_RESULTS',
        note: 'Live web research could not find matching sources.'
      };
    }

    // Rank results based on multi-factor relevance and authority
    const rankedResults = rankSearchResults(allResults, cleanPrompt);
    const topResults = rankedResults.slice(0, 4);
    const sourcesWithContent = [];

    for (const res of topResults) {
      let pageContent = null;
      try {
        const fetchRes = await fetchWeb(res.url, { timeoutMs: 10000, apiKey });
        if (fetchRes.success && fetchRes.content) {
          pageContent = fetchRes.content;
        }
      } catch (err) {
        // Non-fatal, fallback to snippet
      }

      sourcesWithContent.push({
        ...res,
        content: pageContent,
        key_findings: pageContent 
          ? [pageContent.substring(0, 220).replace(/\s+/g, ' ')]
          : [res.snippet]
      });
    }

    const evidence = extractEvidenceObjects(sourcesWithContent);
    const normalized = normalizeResearchResults(queries[0], sourcesWithContent);

    console.log(`[TinyFish Pipeline] Successfully extracted ${sourcesWithContent.length} sources and ${evidence.length} evidence points.`);

    return {
      ...normalized,
      evidence,
      available: sourcesWithContent.length > 0
    };

  } catch (err) {
    console.error('[TinyFish Pipeline] Research error (non-fatal):', err.message);
    return {
      available: false,
      sources: [],
      evidence: [],
      reason: 'FAILED',
      note: 'Live web research encountered an error. Proceeding with domain reasoning.'
    };
  }
};

/**
 * Backward compatibility wrapper for orchestrator and agentService
 */
export const researchForBRD = async (userIdeaOrPrompt, options = {}) => {
  return await executeResearchPipeline(userIdeaOrPrompt, options);
};

export default {
  isTinyFishConfigured,
  getTinyFishClient,
  searchWeb,
  fetchWeb,
  runWebAgent,
  shouldUseLiveResearch,
  normalizeResearchResults,
  extractEvidenceObjects,
  executeResearchPipeline,
  researchForBRD
};
