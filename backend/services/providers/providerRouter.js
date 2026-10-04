import geminiProvider from './geminiProvider.js';
import openaiProvider from './openaiProvider.js';
import sarvamProvider from './sarvamProvider.js';
import tinyfishProvider from './tinyfishProvider.js';

export const PROVIDER_CAPABILITIES = {
  SARVAM: ['stt', 'tts', 'translation', 'indian_languages', 'chat'],
  OPENAI: ['reasoning', 'coding', 'structured_output', 'document', 'chat'],
  GEMINI: ['reasoning', 'multimodal', 'structured_output', 'document', 'chat'],
  TINYFISH: ['web_search', 'web_fetch', 'web_agent', 'research']
};

/**
 * Phase 7: Smart Web Routing
 * Determines whether live web information is required.
 */
export function needsWebResearch(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.toLowerCase();

  // Explicit positive triggers
  const researchKeywords = [
    'competitor', 'competitors', 'competition', 'market research',
    'market analysis', 'current price', 'current pricing', 'latest price',
    'compare', 'comparison', 'pricing in', 'prices in',
    'latest news', 'current trends', 'browse', 'live web', 'search web',
    'find website', 'fetch url', 'http://', 'https://', 'government scheme',
    'latest startup', 'market share', 'valuation', 'industry benchmarks'
  ];

  // Negative overrides (tasks that don't need web search)
  const nonResearchKeywords = [
    'rewrite this', 'explain this code', 'summarize this text',
    'what is a function', 'explain normalization', 'grammar check',
    'translate this', 'hello', 'namaste', 'kaise ho', 'who are you'
  ];

  for (const neg of nonResearchKeywords) {
    if (p.includes(neg) && !p.includes('competitor') && !p.includes('market')) {
      return false;
    }
  }

  return researchKeywords.some(kw => p.includes(kw));
}

/**
 * Get active provider status summary without exposing credentials
 */
export function getProvidersStatus() {
  return {
    sarvam: {
      configured: sarvamProvider.isConfigured(),
      capabilities: PROVIDER_CAPABILITIES.SARVAM,
      models: sarvamProvider.SARVAM_MODELS
    },
    openai: {
      configured: openaiProvider.isConfigured(),
      capabilities: PROVIDER_CAPABILITIES.OPENAI,
      models: openaiProvider.OPENAI_MODELS
    },
    gemini: {
      configured: geminiProvider.isConfigured(),
      capabilities: PROVIDER_CAPABILITIES.GEMINI,
      models: geminiProvider.GEMINI_MODELS
    },
    tinyfish: {
      configured: tinyfishProvider.isConfigured(),
      capabilities: PROVIDER_CAPABILITIES.TINYFISH
    }
  };
}

/**
 * Route reasoning to preferred provider with capability fallback
 */
export async function executeReasoning(prompt, options = {}) {
  const preferred = options.preferredProvider || process.env.PREFERRED_LLM || 'gemini';
  const isStructured = Boolean(options.structured || options.systemPrompt);

  const primary = preferred.toLowerCase() === 'openai' ? openaiProvider : geminiProvider;
  const secondary = preferred.toLowerCase() === 'openai' ? geminiProvider : openaiProvider;

  // 1. Try primary provider if configured
  if (primary.isConfigured()) {
    try {
      if (isStructured) {
        return await primary.generateStructured(prompt, options);
      }
      return await primary.chat([{ role: 'user', content: prompt }], options);
    } catch (err) {
      console.warn(`[ProviderRouter] Primary provider (${preferred}) failed:`, err.message);
    }
  }

  // 2. Try secondary provider if configured
  if (secondary.isConfigured()) {
    try {
      if (isStructured) {
        return await secondary.generateStructured(prompt, options);
      }
      return await secondary.chat([{ role: 'user', content: prompt }], options);
    } catch (err) {
      console.warn(`[ProviderRouter] Fallback provider failed:`, err.message);
    }
  }

  // 3. Try Sarvam chat if query is in Hindi/Hinglish
  if (sarvamProvider.isConfigured() && !isStructured) {
    try {
      return await sarvamProvider.chatCompletion([{ role: 'user', content: prompt }], options);
    } catch (err) {
      console.warn(`[ProviderRouter] Sarvam chat fallback failed:`, err.message);
    }
  }

  // 4. Return robust simulator output
  if (isStructured) {
    return primary.generateStructured(prompt, options);
  }
  return primary.chat([{ role: 'user', content: prompt }], options);
}

export default {
  needsWebResearch,
  getProvidersStatus,
  executeReasoning,
  sarvam: sarvamProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  tinyfish: tinyfishProvider
};
