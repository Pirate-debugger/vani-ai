import axios from 'axios';
import { OpenAI } from 'openai';
import { getSimulatorResponse } from '../data/simulator-responses.js';

/**
 * Operation-specific token and generation configurations
 */
export const OPERATION_CONFIGS = {
  GENERAL_CHAT: { maxTokens: 800, temperature: 0.7 },
  VOICE_RESPONSE: { maxTokens: 200, temperature: 0.6 },
  BRD_GENERATION: { maxTokens: 4096, temperature: 0.4 },
  PRD_GENERATION: { maxTokens: 4096, temperature: 0.4 },
  RESEARCH_SYNTHESIS: { maxTokens: 3000, temperature: 0.5 },
  TASK_EXTRACTION: { maxTokens: 1500, temperature: 0.3 }
};

const getSystemPrompt = (persona, langCode, profileContext, isDocumentAgent = false) => {
  // Document generation prompt must NOT be constrained to 3-4 sentences
  if (isDocumentAgent || persona === 'document_agent') {
    return `You are Vani AI, functioning as a specialized Principal Business Analyst & Document Architect. Produce comprehensive, enterprise-grade, detailed structured documents. Follow all schema and section requirements strictly.`;
  }

  const base = `You are Vani AI, an advanced multilingual voice-first AI assistant for India. Respond in the language code: "${langCode}". Keep replies concise and natural for voice synthesis (max 3-4 sentences). ${profileContext}. If you detect a strong emotion in the user's prompt (like happy, sad, angry, stressed), end your response with an emotion tag like [EMOTION: stressed] or [EMOTION: happy]. Otherwise do not include the tag.`;
  
  switch(persona) {
    case 'tutor':
      return `${base} You are a Student Tutor. Explain educational concepts simply. Focus on clarity.`;
    case 'government':
      return `${base} You are a Government Scheme Expert. Guide users on PM-Kisan, Ayushman Bharat, Mudra loans, eligibility, and required documents.`;
    case 'interview':
      return `${base} You are an Interview Coach. Conduct mock HR or Technical interviews. Ask one question at a time.`;
    case 'career':
      return `${base} You are a Career Mentor. Provide career roadmaps and learning paths.`;
    case 'demo':
      return `You are Vani AI presenting yourself at a Hackathon. Explain your Problem statement (language barrier in India), Solution (voice-first multilingual platform), Tech stack, and Impact. Keep it under 4 sentences in ${langCode}.`;
    case 'rural':
      return `${base} You are a Rural Business Advisor. Guide farmers, shopkeepers, and rural businesses with actionable advice.`;
    default:
      return `${base} You are a helpful, respectful, and friendly digital assistant.`;
  }
};

export const callSarvamLLM = async (messages, prompt, langCode, persona, profileContext, apiKey, options = {}) => {
  const isDoc = options.operationType === 'BRD_GENERATION' || options.operationType === 'PRD_GENERATION' || persona === 'document_agent';
  const systemPrompt = getSystemPrompt(persona, langCode, profileContext, isDoc);
  const maxTokens = options.maxTokens || (isDoc ? 3000 : 350);

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || [{ role: 'user', content: prompt }])
  ];

  const candidateModels = ['sarvam-105b-conversations', 'sarvam-105b'];
  let lastErr = null;

  for (const model of candidateModels) {
    try {
      console.log(`[LLM Sarvam] Trying ${model} (maxTokens: ${maxTokens})...`);
      const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
        model,
        messages: apiMessages,
        temperature: options.temperature || 0.7,
        max_tokens: maxTokens
      }, {
        headers: {
          'api-subscription-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeoutMs || 30000
      });

      const choice = response.data?.choices?.[0]?.message;
      const content = choice?.content?.trim() || choice?.reasoning_content?.trim();
      if (content) {
        return {
          response: content,
          model: response.data.model || model,
          simulated: false
        };
      }
    } catch (err) {
      console.warn(`[LLM Sarvam] ${model} attempt failed:`, err.response?.data?.error?.message || err.message);
      lastErr = err;
    }
  }

  throw new Error(`Sarvam LLM call failed across models: ${lastErr?.message || 'Unknown error'}`);
};

export const callOpenAILLM = async (messages, prompt, langCode, personality, profileContext, apiKey, options = {}) => {
  const openai = new OpenAI({ apiKey });
  const isDoc = options.operationType === 'BRD_GENERATION' || options.operationType === 'PRD_GENERATION' || personality === 'document_agent';
  const systemPrompt = getSystemPrompt(personality, langCode, profileContext, isDoc);
  const maxTokens = options.maxTokens || (isDoc ? 4096 : 400);

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || [{ role: 'user', content: prompt }])
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: apiMessages,
    temperature: options.temperature || 0.7,
    max_tokens: maxTokens
  });

  return {
    response: completion.choices[0].message.content,
    model: 'gpt-4o-mini',
    simulated: false
  };
};

export const callGeminiLLM = async (messages, prompt, langCode, personality, profileContext, apiKey, options = {}) => {
  const isDoc = options.operationType === 'BRD_GENERATION' || options.operationType === 'PRD_GENERATION' || options.operationType === 'TASK_EXTRACTION' || personality === 'document_agent';
  const systemPrompt = getSystemPrompt(personality, langCode, profileContext, isDoc);
  const enableSearch = options.enableSearch || personality === 'research' || personality === 'market_research' || personality === 'deep_research';
  const maxTokens = options.maxTokens || (isDoc ? 4096 : 1000);

  // Build Gemini contents array from messages or prompt
  let contents = [];
  if (messages && messages.length > 0) {
    contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  } else {
    contents = [{
      role: 'user',
      parts: [{ text: prompt }]
    }];
  }

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: options.temperature ?? (isDoc ? 0.4 : 0.7)
    }
  };

  if (isDoc || options.structured || options.responseFormat === 'json') {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  if (enableSearch && !payload.generationConfig.responseMimeType) {
    payload.tools = [{ googleSearch: {} }];
  }

  // Model fallback list with modern active models
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const models = Array.from(new Set([configuredModel, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']));
  let lastErr = null;

  for (const modelName of models) {
    try {
      console.log(`[LLM Gemini] Requesting ${modelName} (maxTokens: ${maxTokens}, search: ${enableSearch ? 'ON' : 'OFF'})...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: options.timeoutMs || 40000 }
      );

      const candidate = response.data?.candidates?.[0];
      const geminiText = candidate?.content?.parts?.[0]?.text;
      if (geminiText) {
        return {
          response: geminiText,
          model: modelName,
          simulated: false,
          groundingMetadata: candidate?.groundingMetadata || null
        };
      }
    } catch (err) {
      console.warn(`[LLM Gemini] ${modelName} attempt failed: ${err.response?.data?.error?.message || err.message}`);
      lastErr = err;
    }
  }

  throw new Error(`Gemini API call failed across models: ${lastErr?.message || 'Unknown error'}`);
};

export const getAIResponse = async ({
  messages,
  prompt,
  langCode = 'hi-IN',
  personality,
  profile,
  provider,
  enableSearch,
  sarvamKey,
  openaiKey,
  geminiKey,
  operationType,
  maxTokens,
  temperature
}) => {
  const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');
  const character = personality || 'respectful';
  const profileContext = profile
    ? `User profile: State=${profile.state || 'unknown'}, Occupation=${profile.occupation || 'unknown'}, Age group=${profile.age || 'unknown'}. Personalize your responses accordingly.`
    : '';

  const options = {
    operationType,
    maxTokens: maxTokens || (operationType ? OPERATION_CONFIGS[operationType]?.maxTokens : undefined),
    temperature: temperature ?? (operationType ? OPERATION_CONFIGS[operationType]?.temperature : undefined),
    enableSearch
  };

  let rawResponse;

  // 1. Explicit Gemini
  if (provider === 'gemini' && geminiKey) {
    try {
      rawResponse = await callGeminiLLM(messages, userPrompt, langCode, character, profileContext, geminiKey, options);
    } catch (err) {
      console.warn('Gemini LLM explicitly requested but failed:', err.message);
    }
  }

  // 2. Explicit OpenAI
  if (!rawResponse && provider === 'openai' && openaiKey) {
    try {
      rawResponse = await callOpenAILLM(messages, userPrompt, langCode, character, profileContext, openaiKey, options);
    } catch (err) {
      console.warn('OpenAI LLM explicitly requested but failed:', err.message);
    }
  }

  // 3. For BRD / PRD / Document Agents: Prefer Gemini or OpenAI over Sarvam for reasoning and large context
  const isDocumentGeneration = operationType === 'BRD_GENERATION' || operationType === 'PRD_GENERATION' || character === 'document_agent';

  if (isDocumentGeneration) {
    if (!rawResponse && geminiKey) {
      try {
        rawResponse = await callGeminiLLM(messages, userPrompt, langCode, character, profileContext, geminiKey, options);
      } catch (err) {
        console.warn('Gemini Document Generation failed:', err.message);
      }
    }
    if (!rawResponse && openaiKey) {
      try {
        rawResponse = await callOpenAILLM(messages, userPrompt, langCode, character, profileContext, openaiKey, options);
      } catch (err) {
        console.warn('OpenAI Document Generation failed:', err.message);
      }
    }
    if (!rawResponse && sarvamKey) {
      try {
        rawResponse = await callSarvamLLM(messages, userPrompt, langCode, character, profileContext, sarvamKey, options);
      } catch (err) {
        console.warn('Sarvam Document Generation failed:', err.message);
      }
    }
  } else {
    // Standard chat flow: Gemini / OpenAI / Sarvam
    if (!rawResponse && geminiKey) {
      try {
        rawResponse = await callGeminiLLM(messages, userPrompt, langCode, character, profileContext, geminiKey, options);
      } catch (err) {
        console.warn('Gemini LLM failed, checking other keys...', err.message);
      }
    }
    if (!rawResponse && openaiKey) {
      try {
        rawResponse = await callOpenAILLM(messages, userPrompt, langCode, character, profileContext, openaiKey, options);
      } catch (err) {
        console.warn('OpenAI API failed, checking other keys...', err.message);
      }
    }
    if (!rawResponse && sarvamKey) {
      try {
        rawResponse = await callSarvamLLM(messages, userPrompt, langCode, character, profileContext, sarvamKey, options);
      } catch (err) {
        console.warn('Sarvam LLM failed...', err.message);
      }
    }
  }

  // 4. Honest error handling - NO SILENT SIMULATORS IN PRODUCTION
  if (!rawResponse) {
    if (process.env.VANI_DEMO_MODE === 'true') {
      console.log(`[LLM Demo Mode] Processing request in: ${langCode} (persona: ${character})`);
      rawResponse = await getSimulatorResponse(userPrompt, langCode, character);
    } else {
      const err = new Error('No AI provider available or all configured providers failed.');
      err.code = 'PROVIDER_UNAVAILABLE';
      err.status = 503;
      err.retryable = true;
      throw err;
    }
  }


  // Parse Emotion
  let emotion = null;
  if (rawResponse?.response && typeof rawResponse.response === 'string') {
    const emotionMatch = rawResponse.response.match(/\[EMOTION:\s*([a-zA-Z]+)\]/i);
    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase();
      rawResponse.response = rawResponse.response.replace(/\[EMOTION:\s*[a-zA-Z]+\]/gi, '').trim();
    }
  }

  if (rawResponse) {
    rawResponse.emotion = emotion;
  }
  return rawResponse;
};
