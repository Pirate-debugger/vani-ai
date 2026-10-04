import geminiProvider from './geminiProvider.js';
import openaiProvider from './openaiProvider.js';
import sarvamProvider from './sarvamProvider.js';
import tinyfishProvider from './tinyfishProvider.js';

export const PROVIDER_CAPABILITIES = {
  SARVAM: ['stt', 'tts', 'translation', 'indian_languages', 'chat'],
  OPENAI: ['reasoning', 'coding', 'technical', 'structured_output', 'document', 'chat'],
  GEMINI: ['reasoning', 'brd', 'prd', 'research_synthesis', 'structured_analysis', 'structured_output', 'document', 'chat'],
  TINYFISH: ['live_web', 'search', 'fetch', 'web_agent', 'research']
};

/**
 * Capability-based default routing map (Section 22)
 *
 * STT                 -> Sarvam
 * TTS                 -> Sarvam
 * Indian Translation  -> Sarvam
 *
 * BRD                 -> Gemini (fallback: OpenAI)
 * PRD                 -> Gemini (fallback: OpenAI)
 * Research Synthesis  -> Gemini (fallback: OpenAI)
 * Structured Analysis -> Gemini (fallback: OpenAI)
 *
 * Coding              -> OpenAI (fallback: Gemini)
 * Technical Agent     -> OpenAI (fallback: Gemini)
 * Complex Technical   -> OpenAI (fallback: Gemini)
 *
 * Live Web            -> TinyFish
 * Search              -> TinyFish
 * Fetch               -> TinyFish
 * Web Agent           -> TinyFish
 */
export const CAPABILITY_ROUTING = {
  stt: { primary: 'sarvam', fallback: [] },
  tts: { primary: 'sarvam', fallback: [] },
  translation: { primary: 'sarvam', fallback: [] },
  indian_languages: { primary: 'sarvam', fallback: ['gemini', 'openai'] },
  
  brd: { primary: 'gemini', fallback: ['openai'] },
  prd: { primary: 'gemini', fallback: ['openai'] },
  research_synthesis: { primary: 'gemini', fallback: ['openai'] },
  structured_analysis: { primary: 'gemini', fallback: ['openai'] },
  structured_output: { primary: 'gemini', fallback: ['openai'] },
  
  coding: { primary: 'openai', fallback: ['gemini'] },
  technical: { primary: 'openai', fallback: ['gemini'] },
  complex_technical: { primary: 'openai', fallback: ['gemini'] },

  live_web: { primary: 'tinyfish', fallback: [] },
  search: { primary: 'tinyfish', fallback: [] },
  fetch: { primary: 'tinyfish', fallback: [] },
  web_agent: { primary: 'tinyfish', fallback: [] },

  general_chat: { primary: 'sarvam', fallback: ['gemini', 'openai'] }
};

/**
 * Resolves the appropriate provider given a task capability and runtime apiKeys
 */
export function resolveProviderForCapability(capability = 'general_chat', apiKeys = {}) {
  const normCap = (capability || 'general_chat').toLowerCase();
  const route = CAPABILITY_ROUTING[normCap] || CAPABILITY_ROUTING.general_chat;

  const providerMap = {
    gemini: {
      id: 'gemini',
      instance: geminiProvider,
      isConfigured: () => geminiProvider.isConfigured(apiKeys.geminiKey)
    },
    openai: {
      id: 'openai',
      instance: openaiProvider,
      isConfigured: () => openaiProvider.isConfigured(apiKeys.openaiKey)
    },
    sarvam: {
      id: 'sarvam',
      instance: sarvamProvider,
      isConfigured: () => sarvamProvider.isConfigured(apiKeys.sarvamKey)
    },
    tinyfish: {
      id: 'tinyfish',
      instance: tinyfishProvider,
      isConfigured: () => tinyfishProvider.isConfigured(apiKeys.tinyfishKey)
    }
  };

  // Check primary
  const primaryProvider = providerMap[route.primary];
  if (primaryProvider && primaryProvider.isConfigured()) {
    return {
      providerName: route.primary,
      provider: primaryProvider.instance,
      isFallback: false
    };
  }

  // Check configured fallbacks in order
  for (const fbName of route.fallback) {
    const fbProvider = providerMap[fbName];
    if (fbProvider && fbProvider.isConfigured()) {
      return {
        providerName: fbName,
        provider: fbProvider.instance,
        isFallback: true
      };
    }
  }

  // Default to primary provider in simulator/offline mode
  return {
    providerName: route.primary,
    provider: primaryProvider ? primaryProvider.instance : geminiProvider,
    isFallback: false,
    offline: true
  };
}

/**
 * Determines whether live web information is required.
 */
export function needsWebResearch(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.toLowerCase();

  // Negative overrides (tasks that don't need web search)
  const nonResearchKeywords = [
    'rewrite this', 'explain this code', 'summarize this text',
    'what is a function', 'explain normalization', 'explain recursion',
    'grammar check', 'translate this', 'hello', 'namaste', 'kaise ho', 'who are you'
  ];

  for (const neg of nonResearchKeywords) {
    if (p.includes(neg) && !p.includes('competitor') && !p.includes('market') && !p.includes('price')) {
      return false;
    }
  }

  // Explicit positive triggers
  const researchKeywords = [
    'competitor', 'competitors', 'pratiyogi', 'competition', 'market research',
    'market analysis', 'current price', 'current pricing', 'latest price',
    'compare', 'comparison', 'pricing in', 'prices in',
    'latest news', 'current trends', 'browse', 'live web', 'search web',
    'find website', 'fetch url', 'http://', 'https://', 'government scheme',
    'latest startup', 'market share', 'valuation', 'industry benchmarks'
  ];

  return researchKeywords.some(kw => p.includes(kw));
}

/**
 * Get active provider status summary without exposing credentials
 */
export function getProvidersStatus(apiKeys = {}) {
  return {
    sarvam: {
      configured: sarvamProvider.isConfigured(apiKeys.sarvamKey),
      capabilities: PROVIDER_CAPABILITIES.SARVAM,
      models: sarvamProvider.SARVAM_MODELS
    },
    openai: {
      configured: openaiProvider.isConfigured(apiKeys.openaiKey),
      capabilities: PROVIDER_CAPABILITIES.OPENAI,
      models: openaiProvider.OPENAI_MODELS
    },
    gemini: {
      configured: geminiProvider.isConfigured(apiKeys.geminiKey),
      capabilities: PROVIDER_CAPABILITIES.GEMINI,
      models: geminiProvider.GEMINI_MODELS
    },
    tinyfish: {
      configured: tinyfishProvider.isConfigured(apiKeys.tinyfishKey),
      capabilities: PROVIDER_CAPABILITIES.TINYFISH
    }
  };
}

/**
 * Route reasoning to preferred provider with capability fallback
 */
export async function executeReasoning(prompt, options = {}) {
  const isStructured = Boolean(options.structured || options.systemPrompt);
  const capability = options.capability || (isStructured ? 'structured_analysis' : 'general_chat');
  const apiKeys = options.apiKeys || {};

  const resolution = resolveProviderForCapability(capability, apiKeys);
  const provider = resolution.provider;

  const execOptions = {
    ...options,
    apiKey: apiKeys[`${resolution.providerName}Key`]
  };

  try {
    if (isStructured && typeof provider.generateStructured === 'function') {
      return await provider.generateStructured(prompt, execOptions);
    }
    if (typeof provider.chat === 'function') {
      return await provider.chat([{ role: 'user', content: prompt }], execOptions);
    }
    if (typeof provider.chatCompletion === 'function') {
      return await provider.chatCompletion([{ role: 'user', content: prompt }], execOptions);
    }
  } catch (err) {
    console.warn(`[ProviderRouter] Primary provider (${resolution.providerName}) failed:`, err.message);

    // Try fallback
    const route = CAPABILITY_ROUTING[capability] || CAPABILITY_ROUTING.general_chat;
    for (const fbName of route.fallback) {
      if (fbName === resolution.providerName) continue;
      const fbProvider = fbName === 'openai' ? openaiProvider : (fbName === 'gemini' ? geminiProvider : sarvamProvider);
      if (fbProvider.isConfigured(apiKeys[`${fbName}Key`])) {
        try {
          const fbOptions = { ...options, apiKey: apiKeys[`${fbName}Key`] };
          if (isStructured && typeof fbProvider.generateStructured === 'function') {
            return await fbProvider.generateStructured(prompt, fbOptions);
          }
          if (typeof fbProvider.chat === 'function') {
            return await fbProvider.chat([{ role: 'user', content: prompt }], fbOptions);
          }
        } catch (fbErr) {
          console.warn(`[ProviderRouter] Fallback provider (${fbName}) failed:`, fbErr.message);
        }
      }
    }
  }

  // Simulator fallback
  if (isStructured && typeof provider.generateStructured === 'function') {
    return await provider.generateStructured(prompt, execOptions);
  }
  return await provider.chat([{ role: 'user', content: prompt }], execOptions);
}

export default {
  PROVIDER_CAPABILITIES,
  CAPABILITY_ROUTING,
  resolveProviderForCapability,
  needsWebResearch,
  getProvidersStatus,
  executeReasoning,
  sarvam: sarvamProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  tinyfish: tinyfishProvider
};
