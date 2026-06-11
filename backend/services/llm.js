import axios from 'axios';
import { OpenAI } from 'openai';
import { getSimulatorResponse } from '../data/simulator-responses.js';

export const callSarvamLLM = async (messages, langCode, apiKey) => {
  let response;
  try {
    console.log(`[LLM Sarvam] Trying sarvam-105b...`);
    response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
      model: 'sarvam-105b',
      messages: messages,
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
      messages: messages,
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
  const systemPrompt = `You are Vani AI, a highly supportive, respectful, and multilingual AI assistant for Indian users. ${profileContext} Respond in a friendly tone using the language code "${langCode}". Current personality mode: "${personality}". Keep replies concise and easy to understand for voice output (max 4 sentences).`;
  
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

export const callGeminiLLM = async (prompt, langCode, apiKey) => {
  const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    contents: [{
      parts: [{
        text: `You are Vani AI, a multilingual voice-first digital assistant for Indian users.
Please reply to this prompt: "${prompt}" in the language of this code "${langCode}".
Make it friendly, respectful, and highly concise for a voice speaker (maximum 3-4 lines).`
      }]
    }]
  });

  const geminiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (geminiText) {
    return {
      response: geminiText,
      model: 'gemini-2.5-flash',
      simulated: false
    };
  }
  throw new Error('No valid response from Gemini');
};

export const getAIResponse = async ({ messages, prompt, langCode, personality, profile, sarvamKey, openaiKey, geminiKey }) => {
  const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');
  const character = personality || 'respectful';
  const profileContext = profile
    ? `User profile: State=${profile.state || 'unknown'}, Occupation=${profile.occupation || 'unknown'}, Age group=${profile.age || 'unknown'}. Personalize your responses accordingly.`
    : '';

  if (sarvamKey) {
    console.log(`[LLM Sarvam] Generating completion for: "${userPrompt.substring(0, 30)}..."`);
    try {
      return await callSarvamLLM(messages || [{ role: 'user', content: userPrompt }], langCode, sarvamKey);
    } catch (err) {
      console.warn('Sarvam LLM failed, checking other keys...', err.message);
    }
  }

  if (openaiKey) {
    console.log(`[LLM OpenAI] Generating completion...`);
    try {
      return await callOpenAILLM(messages, userPrompt, langCode, character, profileContext, openaiKey);
    } catch (err) {
      console.warn('OpenAI API failed, checking other keys...', err.message);
    }
  }

  if (geminiKey) {
    console.log(`[LLM Gemini] Generating completion via Gemini 2.5 Flash API...`);
    try {
      return await callGeminiLLM(userPrompt, langCode, geminiKey);
    } catch (err) {
      console.warn('Gemini API failed, falling back to simulator...', err.message);
    }
  }

  console.log(`[LLM Simulator] Processing localized Indian request in: ${langCode}`);
  return await getSimulatorResponse(userPrompt, langCode, character);
};
