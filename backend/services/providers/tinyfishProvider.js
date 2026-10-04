import { TinyFish } from '@tiny-fish/sdk';

export function isTinyFishConfigured() {
  return Boolean(process.env.TINYFISH_API_KEY && process.env.TINYFISH_API_KEY.trim() !== '');
}

function getClient() {
  if (!isTinyFishConfigured()) return null;
  return new TinyFish({
    apiKey: process.env.TINYFISH_API_KEY
  });
}

/**
 * TinyFish Search: discover URLs and snippets
 */
export async function searchWeb(query, options = {}) {
  const limit = options.limit || 5;
  if (!isTinyFishConfigured()) {
    console.log(`[TinyFish Search Simulator] Querying: "${query}" (limit: ${limit})`);
    return [
      {
        title: 'Top Student PGs in India - Housing & Stanza Living Review',
        url: 'https://example.com/pg-market-analysis',
        snippet: 'Average student PG rent in Pune & Bengaluru ranges from 6,000 to 14,000 INR/month including food and WiFi.',
        domain: 'example.com'
      }
    ];
  }

  try {
    const client = getClient();
    const results = await client.search({
      query,
      limit,
      timeout: options.timeout || 15000
    });

    const items = results?.items || results?.results || results || [];
    return items.map(item => ({
      title: item.title || 'Web Search Result',
      url: item.url || item.link || '',
      snippet: item.snippet || item.description || item.content || '',
      domain: extractDomain(item.url || item.link || '')
    }));
  } catch (error) {
    console.warn(`[TinyFish Search Warning] Query "${query}" failed:`, error.message);
    return [];
  }
}

/**
 * TinyFish Fetch: retrieve clean rendered markdown / text
 */
export async function fetchWeb(url, options = {}) {
  if (!isTinyFishConfigured()) {
    console.log(`[TinyFish Fetch Simulator] Fetching URL: ${url}`);
    return {
      url,
      title: 'Market Overview: Student Accommodations',
      content: 'Market data indicates 35% growth in managed student co-living spaces with security deposits being a major pain point.',
      domain: extractDomain(url)
    };
  }

  try {
    const client = getClient();
    const result = await client.fetch({
      url,
      format: 'markdown',
      timeout: options.timeout || 15000
    });

    return {
      url,
      title: result?.title || '',
      content: result?.content || result?.markdown || result?.text || '',
      domain: extractDomain(url)
    };
  } catch (error) {
    console.warn(`[TinyFish Fetch Warning] Fetching "${url}" failed:`, error.message);
    return null;
  }
}

/**
 * TinyFish Web Agent: navigate or interact with web goal
 */
export async function runWebAgent(url, goal, options = {}) {
  if (!isTinyFishConfigured()) {
    console.log(`[TinyFish WebAgent Simulator] Running goal on ${url}: "${goal}"`);
    return {
      url,
      goal,
      success: true,
      summary: `Simulated browser agent completed task: ${goal}`,
      findings: ['Found student PG listing starting at 7,500/month', 'Verified amenities included']
    };
  }

  try {
    const client = getClient();
    const agentResult = await client.agent({
      url,
      goal,
      timeout: options.timeout || 30000
    });

    return {
      url,
      goal,
      success: Boolean(agentResult?.success ?? true),
      summary: agentResult?.summary || agentResult?.result || '',
      findings: agentResult?.findings || []
    };
  } catch (error) {
    console.warn(`[TinyFish WebAgent Warning] Agent failed on "${url}":`, error.message);
    return {
      url,
      goal,
      success: false,
      error: error.message
    };
  }
}

/**
 * Comprehensive Web Research (Search -> Select -> Fetch -> Normalize)
 */
export async function researchWeb(query, options = {}) {
  if (!isTinyFishConfigured()) {
    console.log(`[TinyFish Pipeline] TinyFish not configured. Proceeding without live research.`);
    return {
      query,
      researchUsed: false,
      sources: [],
      competitors: [],
      market_signals: [],
      pricing_signals: [],
      risks: []
    };
  }

  try {
    const searchResults = await searchWeb(query, { limit: options.limit || 4 });
    if (!searchResults.length) {
      return { query, researchUsed: false, sources: [], competitors: [], market_signals: [], pricing_signals: [], risks: [] };
    }

    const fetchedSources = [];
    for (const res of searchResults.slice(0, 3)) {
      if (!res.url) continue;
      const page = await fetchWeb(res.url, { timeout: 10000 });
      fetchedSources.push({
        title: res.title,
        url: res.url,
        domain: res.domain || extractDomain(res.url),
        snippet: res.snippet,
        key_findings: page?.content
          ? [page.content.slice(0, 200).replace(/\n+/g, ' ')]
          : [res.snippet]
      });
    }

    return {
      query,
      researchUsed: fetchedSources.length > 0,
      sources: fetchedSources,
      competitors: extractCompetitors(fetchedSources),
      market_signals: [`Active market demand identified for query: "${query}"`],
      pricing_signals: [],
      risks: []
    };
  } catch (error) {
    console.warn('[TinyFish Research Pipeline Error]:', error.message);
    return { query, researchUsed: false, sources: [], competitors: [], market_signals: [], pricing_signals: [], risks: [] };
  }
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
      findings: s.key_findings
    }))
  };
}

function extractDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractCompetitors(sources) {
  const competitors = [];
  const knownKeywords = ['stanza', 'nestaway', 'oyolife', 'zolo', 'yourspace', 'coho', 'amber'];
  for (const s of sources) {
    const text = `${s.title} ${s.snippet}`.toLowerCase();
    for (const kw of knownKeywords) {
      if (text.includes(kw) && !competitors.includes(kw)) {
        competitors.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    }
  }
  return competitors;
}

export default {
  isConfigured: isTinyFishConfigured,
  searchWeb,
  fetchWeb,
  runWebAgent,
  researchWeb,
  compareWebSources
};
