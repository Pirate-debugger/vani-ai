import OpenAI from 'openai';

export const OPENAI_MODELS = {
  CHAT: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
  REASONING: process.env.OPENAI_REASONING_MODEL || 'gpt-4o',
  DOCUMENT: process.env.OPENAI_DOCUMENT_MODEL || 'gpt-4o',
  CODE: process.env.OPENAI_CODE_MODEL || 'gpt-4o'
};

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new OpenAI({ apiKey: apiKey.trim() });
}

export function isOpenAIConfigured(overrideKey) {
  const key = overrideKey || process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim() !== '');
}

/**
 * Standard Chat Completion
 */
export async function chat(messages, options = {}) {
  const apiKey = options.apiKey || options.openaiKey;
  const modelType = options.modelType || 'CHAT';
  const model = options.model || OPENAI_MODELS[modelType] || OPENAI_MODELS.CHAT;

  if (!isOpenAIConfigured(apiKey)) {
    return {
      text: 'Simulated OpenAI response: Vani AI is operating in development mode.',
      simulated: true,
      provider: 'openai',
      model
    };
  }

  const client = getClient(apiKey);
  const formattedMessages = Array.isArray(messages) 
    ? messages.map(m => typeof m === 'string' ? { role: 'user', content: m } : m)
    : [{ role: 'user', content: String(messages) }];

  const response = await client.chat.completions.create({
    model,
    messages: formattedMessages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens || options.maxTokens || 1000
  });

  return {
    text: response.choices[0]?.message?.content || '',
    simulated: false,
    provider: 'openai',
    model,
    usage: response.usage
  };
}

/**
 * Generate Structured Output with JSON Schema / Object format
 */
export async function generateStructured(prompt, options = {}) {
  const apiKey = options.apiKey || options.openaiKey;
  const systemPrompt = options.systemPrompt || 'You are an expert AI system architect. Output valid JSON adhering strictly to the requested schema.';
  const modelType = options.modelType || 'DOCUMENT';
  const model = options.model || OPENAI_MODELS[modelType] || OPENAI_MODELS.DOCUMENT;

  if (!isOpenAIConfigured(apiKey)) {
    return {
      text: JSON.stringify({
        title: 'Student PG Finder Startup BRD',
        summary: 'A marketplace for students to find verified PG accommodations in India.',
        content: '# Business Requirements Document\n\n## 1. Executive Summary\nStudent PG Finder addresses affordable housing for students.',
        metadata: { researchUsed: false, confidence: 'high' }
      }),
      simulated: true,
      provider: 'openai',
      model
    };
  }

  const client = getClient(apiKey);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const params = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens || options.maxTokens || 4096,
    response_format: { type: 'json_object' }
  };

  const response = await client.chat.completions.create(params);
  return {
    text: response.choices[0]?.message?.content || '',
    simulated: false,
    provider: 'openai',
    model,
    usage: response.usage
  };
}

export default {
  isConfigured: isOpenAIConfigured,
  chat,
  generateStructured,
  OPENAI_MODELS
};
