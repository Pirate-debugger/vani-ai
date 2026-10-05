import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS = {
  FAST: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  REASONING: process.env.GEMINI_REASONING_MODEL || 'gemini-3.5-flash',
  DOCUMENT: process.env.GEMINI_DOCUMENT_MODEL || 'gemini-3.5-flash',
  LITE: 'gemini-3.5-flash-lite'
};

function getClient(overrideKey) {
  const apiKey = overrideKey !== undefined ? overrideKey : process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

export function isGeminiConfigured(overrideKey) {
  const key = overrideKey !== undefined ? overrideKey : process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '');
}

/**
 * Chat completion with Gemini
 */
export async function chat(messages, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.geminiKey !== undefined ? options.geminiKey : process.env.GEMINI_API_KEY);
  const configured = isGeminiConfigured(apiKey);
  const model = options.model || GEMINI_MODELS.FAST;

  if (!configured) {
    if (options.demo || process.env.VANI_DEMO_MODE === 'true') {
      return {
        text: 'Demo mode active. Please configure your Gemini API Key in Settings for live reasoning.',
        simulated: true,
        provider: 'gemini',
        model
      };
    }
    const err = new Error('Gemini API is not configured. Please add your GEMINI_API_KEY in Settings.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'gemini';
    err.status = 503;
    throw err;
  }

  const ai = getClient(apiKey);
  const prompt = Array.isArray(messages)
    ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    : String(messages);

  const candidateModels = Array.from(new Set([model, GEMINI_MODELS.FAST, GEMINI_MODELS.LITE]));
  let lastErr = null;

  for (const m of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: prompt,
        config: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.max_tokens || options.maxTokens || 1000
        }
      });

      return {
        text: response.text || '',
        simulated: false,
        provider: 'gemini',
        model: m
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[geminiProvider] ${m} failed, trying fallback:`, err.message);
    }
  }

  throw lastErr;
}

/**
 * Generate Structured Output with JSON Schema
 */
export async function generateStructured(prompt, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.geminiKey !== undefined ? options.geminiKey : process.env.GEMINI_API_KEY);
  const configured = isGeminiConfigured(apiKey);
  const systemInstruction = options.systemPrompt || 'You are an expert Enterprise Business Analyst. Generate valid JSON matching the requested structure.';
  const model = options.model || GEMINI_MODELS.DOCUMENT;

  if (!configured) {
    if (options.demo || process.env.VANI_DEMO_MODE === 'true') {
      return {
        text: JSON.stringify({
          title: 'Demo Document',
          summary: 'Gemini is operating in demo mode. Configure your API key in Settings to generate custom documents.',
          content: '# Demo Document\n\nConfigure your GEMINI_API_KEY to generate live documents.',
          metadata: { researchUsed: false, confidence: 'medium' }
        }),
        simulated: true,
        provider: 'gemini',
        model
      };
    }
    const err = new Error('Gemini API is not configured for document generation. Please add your GEMINI_API_KEY in Settings.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'gemini';
    err.status = 503;
    throw err;
  }

  const ai = getClient(apiKey);
  const candidateModels = Array.from(new Set([model, GEMINI_MODELS.DOCUMENT, GEMINI_MODELS.LITE]));
  let lastErr = null;

  for (const m of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.max_tokens || options.maxTokens || 4096,
          responseMimeType: 'application/json'
        }
      });

      return {
        text: response.text || '',
        simulated: false,
        provider: 'gemini',
        model: m
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[geminiProvider] ${m} structured generation failed, trying fallback:`, err.message);
    }
  }

  throw lastErr;
}

/**
 * Real Native Token Streaming with Gemini
 */
export async function streamChat(messages, options = {}, onChunk = () => {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.geminiKey !== undefined ? options.geminiKey : process.env.GEMINI_API_KEY);
  const configured = isGeminiConfigured(apiKey);
  const model = options.model || GEMINI_MODELS.FAST;

  if (!configured) {
    const err = new Error('Gemini API is not configured for streaming.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'gemini';
    err.status = 503;
    throw err;
  }

  const ai = getClient(apiKey);
  const prompt = Array.isArray(messages)
    ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    : String(messages);

  const candidateModels = Array.from(new Set([model, GEMINI_MODELS.FAST, GEMINI_MODELS.LITE]));
  let lastErr = null;

  for (const m of candidateModels) {
    try {
      const stream = await ai.models.generateContentStream({
        model: m,
        contents: prompt,
        config: {
          systemInstruction: options.systemPrompt,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.max_tokens || options.maxTokens || 2048
        }
      });

      let fullText = '';
      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }

      return {
        text: fullText,
        model: m,
        provider: 'gemini'
      };
    } catch (err) {
      lastErr = err;
      console.warn(`[geminiProvider] ${m} streaming failed, trying fallback:`, err.message);
    }
  }

  throw lastErr;
}

export default {
  isConfigured: isGeminiConfigured,
  chat,
  generateStructured,
  streamChat,
  GEMINI_MODELS
};
