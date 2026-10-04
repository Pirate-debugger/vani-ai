import OpenAI from 'openai';

export const OPENAI_MODELS = {
  CHAT: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  REASONING: process.env.OPENAI_REASONING_MODEL || 'gpt-4o',
  DOCUMENT: process.env.OPENAI_DOCUMENT_MODEL || 'gpt-4o',
  CODE: process.env.OPENAI_CODE_MODEL || 'gpt-4o'
};

let clientInstance = null;

function getClient() {
  if (!clientInstance && process.env.OPENAI_API_KEY) {
    clientInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return clientInstance;
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '');
}

/**
 * Standard Chat Completion
 */
export async function chat(messages, options = {}) {
  const modelType = options.modelType || 'CHAT';
  const model = options.model || OPENAI_MODELS[modelType] || OPENAI_MODELS.CHAT;

  if (!isOpenAIConfigured()) {
    return {
      text: 'Simulated OpenAI response: Vani AI is operating in development mode.',
      simulated: true,
      provider: 'openai',
      model
    };
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens || 1000
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
  const systemPrompt = options.systemPrompt || 'You are an expert AI system architect. Output valid JSON adhering strictly to the requested schema.';
  const modelType = options.modelType || 'DOCUMENT';
  const model = options.model || OPENAI_MODELS[modelType] || OPENAI_MODELS.DOCUMENT;

  if (!isOpenAIConfigured()) {
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

  const client = getClient();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const params = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens || 4096,
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
