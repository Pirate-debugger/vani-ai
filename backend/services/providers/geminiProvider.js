import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS = {
  FAST: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  REASONING: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-flash',
  DOCUMENT: process.env.GEMINI_DOCUMENT_MODEL || 'gemini-2.5-flash'
};

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

export function isGeminiConfigured(overrideKey) {
  const key = overrideKey || process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '');
}

/**
 * Chat completion with Gemini
 */
export async function chat(messages, options = {}) {
  const apiKey = options.apiKey || options.geminiKey;
  const configured = isGeminiConfigured(apiKey);
  const model = options.model || GEMINI_MODELS.FAST;

  if (!configured) {
    return {
      text: 'Simulated Gemini response: Operating in offline development mode.',
      simulated: true,
      provider: 'gemini',
      model
    };
  }

  const ai = getClient(apiKey);
  const prompt = Array.isArray(messages)
    ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    : String(messages);

  const response = await ai.models.generateContent({
    model,
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
    model
  };
}

/**
 * Generate Structured Output with JSON Schema
 */
export async function generateStructured(prompt, options = {}) {
  const apiKey = options.apiKey || options.geminiKey;
  const configured = isGeminiConfigured(apiKey);
  const systemInstruction = options.systemPrompt || 'You are an expert Enterprise Business Analyst. Generate valid JSON matching the requested structure.';
  const model = options.model || GEMINI_MODELS.DOCUMENT;

  if (!configured) {
    return {
      text: JSON.stringify({
        title: 'Student PG Finder Startup BRD',
        summary: 'A curated discovery and booking platform for student housing across Tier 1 and Tier 2 cities in India.',
        content: '# Business Requirements Document\n\n## 1. Executive Summary\nStudent PG Finder addresses affordable student housing.',
        metadata: { researchUsed: false, confidence: 'high' }
      }),
      simulated: true,
      provider: 'gemini',
      model
    };
  }

  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model,
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
    model
  };
}

export default {
  isConfigured: isGeminiConfigured,
  chat,
  generateStructured,
  GEMINI_MODELS
};
