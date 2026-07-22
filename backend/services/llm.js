import axios from 'axios';
import { OpenAI } from 'openai';
import { getSimulatorResponse } from '../data/simulator-responses.js';

const getSystemPrompt = (persona, langCode, profileContext) => {
  const base = `You are Vani AI, an advanced multilingual AI assistant for India. Respond in the language code: "${langCode}". Keep replies highly concise for voice output (max 3-4 sentences). ${profileContext}. If you detect a strong emotion in the user's prompt (like happy, sad, angry, stressed), end your response with an emotion tag like [EMOTION: stressed] or [EMOTION: happy]. Otherwise do not include the tag.`;
  
  switch(persona) {
    case 'tutor':
      return `${base} You are a Student Tutor. Explain educational concepts simply. Generate quizzes and MCQs if asked. Focus on clarity.`;
    case 'government':
      return `${base} You are a Government Scheme Expert. Guide users on PM-Kisan, Ayushman Bharat, Mudra loans, eligibility, and required documents.`;
    case 'interview':
      return `${base} You are an Interview Coach. Conduct mock HR or Technical interviews. Ask one question at a time. Rate answers and provide constructive feedback.`;
    case 'career':
      return `${base} You are a Career Mentor. Provide career roadmaps, learning paths, and guidance for BCA, MCA, Engineering, and other students.`;
    case 'demo':
      return `You are Vani AI presenting yourself at a Hackathon. Explain your Problem statement (language barrier in India), Solution (voice-first multilingual platform), Tech stack (React, Node, Sarvam API, Gemini), Impact, and Future scope. Keep it under 5 sentences, enthusiastic and concise for voice output in ${langCode}.`;
    case 'rural':
      return `${base} You are a Rural Business Advisor. Guide farmers, shopkeepers, and rural businesses with agriculture tips, weather, and marketing.`;
    case 'document_agent':
      return `You are Vani AI, functioning as a specialized Document Generator Agent. Produce highly professional, structured, and detailed content.`;
    default:
      return `${base} You are a helpful, respectful, and friendly digital assistant.`;
  }
};

export const callSarvamLLM = async (messages, prompt, langCode, persona, profileContext, apiKey) => {
  const systemPrompt = getSystemPrompt(persona, langCode, profileContext);
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || [{ role: 'user', content: prompt }])
  ];

  let response;
  try {
    console.log(`[LLM Sarvam] Trying sarvam-105b...`);
    response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
      model: 'sarvam-105b',
      messages: apiMessages,
      temperature: 0.7,
      reasoning_effort: null,
      max_tokens: 300
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err1) {
    console.warn('Sarvam 105b failed, trying sarvam-30b...', err1.message);
    response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
      model: 'sarvam-30b',
      messages: apiMessages,
      temperature: 0.7,
      reasoning_effort: null,
      max_tokens: 300
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  if (response.data?.choices?.[0]?.message?.content) {
    return {
      response: response.data.choices[0].message.content,
      model: response.data.model || 'sarvam-105b',
      simulated: false
    };
  }
  throw new Error('No valid response from Sarvam');
};

export const callOpenAILLM = async (messages, prompt, langCode, personality, profileContext, apiKey) => {
  const openai = new OpenAI({ apiKey });
  const systemPrompt = getSystemPrompt(personality, langCode, profileContext);
  
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || [{ role: 'user', content: prompt }])
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 400
  });

  return {
    response: completion.choices[0].message.content,
    model: 'gpt-4o-mini',
    simulated: false
  };
};

export const callGeminiLLM = async (messages, prompt, langCode, personality, profileContext, apiKey, options = {}) => {
  const systemPrompt = getSystemPrompt(personality, langCode, profileContext);
  const enableSearch = options.enableSearch || personality === 'research' || personality === 'market_research' || personality === 'deep_research';

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
    contents
  };

  if (enableSearch) {
    payload.tools = [{ googleSearch: {} }];
  }

  // Model fallback list
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  let lastErr = null;

  for (const modelName of models) {
    try {
      console.log(`[LLM Gemini] Requesting ${modelName} (search grounding: ${enableSearch ? 'ON' : 'OFF'})...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
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

export const getAIResponse = async ({ messages, prompt, langCode, personality, profile, provider, enableSearch, sarvamKey, openaiKey, geminiKey }) => {
  const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');
  const character = personality || 'respectful';
  const profileContext = profile
    ? `User profile: State=${profile.state || 'unknown'}, Occupation=${profile.occupation || 'unknown'}, Age group=${profile.age || 'unknown'}. Personalize your responses accordingly.`
    : '';

  let rawResponse;

  if (provider === 'gemini' && geminiKey) {
    console.log(`[LLM Gemini] Provider explicitly set to Gemini...`);
    try {
      rawResponse = await callGeminiLLM(messages, userPrompt, langCode, character, profileContext, geminiKey, { enableSearch });
    } catch (err) {
      console.warn('Gemini LLM explicitly requested but failed:', err.message);
    }
  }

  if (!rawResponse && sarvamKey) {
    console.log(`[LLM Sarvam] Generating completion for: "${userPrompt.substring(0, 30)}..."`);
    try {
      rawResponse = await callSarvamLLM(messages, userPrompt, langCode, character, profileContext, sarvamKey);
    } catch (err) {
      console.warn('Sarvam LLM failed, checking other keys...', err.message);
    }
  }

  if (!rawResponse && openaiKey) {
    console.log(`[LLM OpenAI] Generating completion...`);
    try {
      rawResponse = await callOpenAILLM(messages, userPrompt, langCode, character, profileContext, openaiKey);
    } catch (err) {
      console.warn('OpenAI API failed, checking other keys...', err.message);
    }
  }

  if (!rawResponse && geminiKey) {
    console.log(`[LLM Gemini] Generating completion via Gemini API...`);
    try {
      rawResponse = await callGeminiLLM(messages, userPrompt, langCode, character, profileContext, geminiKey, { enableSearch });
    } catch (err) {
      console.warn('Gemini API failed, falling back to simulator...', err.message);
    }
  }

  if (!rawResponse) {
    console.log(`[LLM Simulator] Processing localized Indian request in: ${langCode}`);
    rawResponse = await getSimulatorResponse(userPrompt, langCode, character);
  }

  // Parse Emotion
  let emotion = null;
  if (rawResponse.response) {
    const emotionMatch = rawResponse.response.match(/\[EMOTION:\s*([a-zA-Z]+)\]/i);
    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase();
      rawResponse.response = rawResponse.response.replace(/\[EMOTION:\s*[a-zA-Z]+\]/gi, '').trim();
    }
  }
  
  rawResponse.emotion = emotion;
  return rawResponse;
};

