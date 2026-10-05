import { 
  searchWeb as coreSearchWeb, 
  fetchWeb as coreFetchWeb, 
  runWebAgent as coreRunWebAgent, 
  executeResearchPipeline,
  isTinyFishConfigured as coreIsConfigured 
} from '../tinyfish.js';

export function isTinyFishConfigured(overrideKey) {
  return coreIsConfigured(overrideKey);
}

/**
 * TinyFish Search: discover URLs and snippets
 */
export async function searchWeb(query, options = {}) {
  const limit = options.limit || 5;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.tinyfishKey !== undefined ? options.tinyfishKey : process.env.TINYFISH_API_KEY);

  if (!isTinyFishConfigured(apiKey)) {
    console.log(`[TinyFish Search] TinyFish not configured. Returning empty search results.`);
    return [];
  }

  const res = await coreSearchWeb(query, { ...options, limit, apiKey });
  return res.results || [];
}

/**
 * TinyFish Fetch: retrieve clean rendered markdown / text
 */
export async function fetchWeb(url, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.tinyfishKey !== undefined ? options.tinyfishKey : process.env.TINYFISH_API_KEY);

  if (!isTinyFishConfigured(apiKey)) {
    console.log(`[TinyFish Fetch] TinyFish not configured. Returning null content.`);
    return null;
  }

  const res = await coreFetchWeb(url, { ...options, apiKey });
  return res.content ? { url, content: res.content, title: res.title || 'Web Content', domain: res.domain } : null;
}

/**
 * TinyFish Web Agent: navigate or interact with web goal
 */
export async function runWebAgent(url, goal, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.tinyfishKey !== undefined ? options.tinyfishKey : process.env.TINYFISH_API_KEY);

  if (!isTinyFishConfigured(apiKey)) {
    const err = new Error('TinyFish API is not configured for browser automation.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'tinyfish';
    err.status = 503;
    throw err;
  }

  const res = await coreRunWebAgent(url, goal, { ...options, apiKey });
  return {
    url,
    goal,
    success: res.success,
    summary: typeof res.output === 'string' ? res.output : JSON.stringify(res.output || ''),
    findings: []
  };
}

/**
 * Comprehensive Web Research (Search -> Select -> Fetch -> Normalize -> Evidence)
 */
export async function researchWeb(query, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.tinyfishKey !== undefined ? options.tinyfishKey : process.env.TINYFISH_API_KEY);

  if (!isTinyFishConfigured(apiKey)) {
    console.log(`[TinyFish Pipeline] TinyFish not configured. Proceeding without live research.`);
    return {
      query,
      researchUsed: false,
      available: false,
      sources: [],
      evidence: [],
      competitors: [],
      market_signals: [],
      pricing_signals: [],
      risks: []
    };
  }

  const result = await executeResearchPipeline(query, { ...options, apiKey });
  return {
    query,
    researchUsed: Boolean(result.available && result.sources?.length > 0),
    available: Boolean(result.available && result.sources?.length > 0),
    sources: result.sources || [],
    evidence: result.evidence || [],
    competitors: result.competitors || [],
    market_signals: result.market_signals || [],
    pricing_signals: result.pricing_signals || [],
    risks: result.risks || []
  };
}

/**
 * Compare Multiple Web Sources
 */
export async function compareWebSources(query, options = {}) {
  const research = await researchWeb(query, options);
  return {
    query,
    sourceCount: research.sources.length,
    comparison: research.sources.map(s => ({
      domain: s.domain,
      title: s.title,
      findings: s.key_findings || [s.snippet]
    }))
  };
}

export default {
  isConfigured: isTinyFishConfigured,
  searchWeb,
  fetchWeb,
  runWebAgent,
  researchWeb,
  compareWebSources
};
