import axios from 'axios';
import FormData from 'form-data';

const SARVAM_BASE_URL = 'https://api.sarvam.ai';

// Modern Supported Sarvam Models
export const SARVAM_MODELS = {
  STT: process.env.SARVAM_STT_MODEL || 'saaras:v4',
  TTS: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
  TRANSLATION: process.env.SARVAM_TRANSLATION_MODEL || 'mayura:v1',
  LLM: process.env.SARVAM_LLM_MODEL || 'sarvam-105b',
  CONVERSATIONS: process.env.SARVAM_CHAT_MODEL || 'sarvam-105b-conversations'
};

export const SUPPORTED_LANGUAGES = [
  'hi-IN', 'en-IN', 'bn-IN', 'ta-IN', 'te-IN',
  'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'od-IN'
];

/**
 * Check if Sarvam API is configured
 */
export function isSarvamConfigured(overrideKey) {
  const key = overrideKey !== undefined ? overrideKey : process.env.SARVAM_API_KEY;
  return Boolean(key && String(key).trim() !== '');
}

/**
 * Speech to Text (Saaras v4)
 */
export async function transcribeAudio(audioBuffer, options = {}) {
  const languageCode = options.languageCode || 'hi-IN';
  const model = options.model || SARVAM_MODELS.STT;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.sarvamKey || process.env.SARVAM_API_KEY);

  if (!isSarvamConfigured(apiKey)) {
    const err = new Error('Sarvam API key is not configured for Speech-to-Text.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'sarvam';
    err.status = 503;
    throw err;
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: options.contentType || 'audio/wav'
    });
    formData.append('model', model);
    if (languageCode && languageCode !== 'auto') {
      formData.append('language_code', languageCode);
    }

    const response = await axios.post(`${SARVAM_BASE_URL}/speech-to-text`, formData, {
      headers: {
        'api-subscription-key': apiKey,
        ...formData.getHeaders()
      },
      timeout: 25000
    });

    return {
      transcript: response.data.transcript || '',
      language_code: response.data.language_code || languageCode,
      simulated: false
    };
  } catch (error) {
    console.error('[Sarvam STT Error]', error?.response?.data || error.message);
    const err = new Error(error?.response?.data?.message || 'Sarvam Speech-to-Text transcription failed');
    err.provider = 'sarvam';
    err.details = error?.response?.data || error.message;
    throw err;
  }
}

/**
 * Text to Speech (Bulbul v3)
 */
export async function synthesizeSpeech(text, options = {}) {
  const targetLanguage = options.targetLanguage || options.language_code || 'hi-IN';
  let defaultSpeaker = 'priya';
  if (targetLanguage.startsWith('ta')) defaultSpeaker = 'kavitha';
  else if (targetLanguage.startsWith('mr')) defaultSpeaker = 'ritu';
  else if (targetLanguage.startsWith('en')) defaultSpeaker = 'neha';
  
  const VALID_BULBUL_SPEAKERS = new Set([
    'priya', 'ritu', 'neha', 'pooja', 'rohan', 'aditya', 'rahul', 'kavitha', 'simran', 'ajay', 'ishaan'
  ]);
  const requestedSpeaker = options.speaker?.toLowerCase();
  const speaker = (requestedSpeaker && VALID_BULBUL_SPEAKERS.has(requestedSpeaker)) ? requestedSpeaker : defaultSpeaker;
  const speechSampleRate = options.speechSampleRate || 22050;
  const model = options.model || SARVAM_MODELS.TTS;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.sarvamKey || process.env.SARVAM_API_KEY);

  if (!isSarvamConfigured(apiKey)) {
    const err = new Error('Sarvam API key is not configured for Text-to-Speech synthesis.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'sarvam';
    err.status = 503;
    throw err;
  }

  try {
    const response = await axios.post(`${SARVAM_BASE_URL}/text-to-speech`, {
      inputs: [text],
      target_language_code: targetLanguage,
      speaker: speaker,
      speech_sample_rate: speechSampleRate,
      enable_preprocessing: true,
      model: model
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    const audioBase64 = response.data.audios?.[0] || response.data.audio || '';
    return {
      audioBase64,
      simulated: false
    };
  } catch (error) {
    console.error('[Sarvam TTS Error]', error?.response?.data || error.message);
    const err = new Error(error?.response?.data?.message || 'Sarvam Text-to-Speech synthesis failed');
    err.provider = 'sarvam';
    err.details = error?.response?.data || error.message;
    throw err;
  }
}

/**
 * Translation (Mayura v1)
 */
export async function translateText(text, options = {}) {
  const sourceLang = options.sourceLanguage || options.source_language_code || 'auto';
  const targetLang = options.targetLanguage || options.target_language_code || 'hi-IN';
  const model = options.model || SARVAM_MODELS.TRANSLATION;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.sarvamKey || process.env.SARVAM_API_KEY);

  if (!isSarvamConfigured(apiKey)) {
    const err = new Error('Sarvam API key is not configured for translation.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'sarvam';
    err.status = 503;
    throw err;
  }

  try {
    const response = await axios.post(`${SARVAM_BASE_URL}/translate`, {
      input: text,
      source_language_code: sourceLang,
      target_language_code: targetLang,
      model: model,
      mode: options.mode || 'formal'
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return {
      translatedText: response.data.translated_text || text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      simulated: false
    };
  } catch (error) {
    console.error('[Sarvam Translate Error]', error?.response?.data || error.message);
    const err = new Error(error?.response?.data?.message || 'Sarvam Translation failed');
    err.provider = 'sarvam';
    throw err;
  }
}

/**
 * LLM Chat Completion (Sarvam-105B Conversations)
 */
export async function chatCompletion(messages, options = {}) {
  const model = options.model || (options.isReasoning ? SARVAM_MODELS.LLM : SARVAM_MODELS.CONVERSATIONS);
  const apiKey = options.apiKey !== undefined ? options.apiKey : (options.sarvamKey || process.env.SARVAM_API_KEY);

  if (!isSarvamConfigured(apiKey)) {
    const err = new Error('Sarvam API key is not configured for Chat Completion.');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    err.provider = 'sarvam';
    err.status = 503;
    throw err;
  }

  const formattedMessages = Array.isArray(messages) 
    ? messages.map(m => typeof m === 'string' ? { role: 'user', content: m } : m)
    : [{ role: 'user', content: String(messages) }];

  try {
    const response = await axios.post(`${SARVAM_BASE_URL}/v1/chat/completions`, {
      model: model,
      messages: formattedMessages,
      temperature: options.temperature || 0.3,
      max_tokens: options.max_tokens || options.maxTokens || 800
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const msg = response.data?.choices?.[0]?.message;
    const content = (msg?.content && msg.content.trim()) || (msg?.reasoning_content && msg.reasoning_content.trim()) || '';
    return {
      text: content,
      simulated: false,
      provider: 'sarvam',
      model
    };
  } catch (error) {
    console.error('[Sarvam Chat Error]', error?.response?.data || error.message);
    const err = new Error(error?.response?.data?.message || 'Sarvam chat completion failed');
    err.provider = 'sarvam';
    throw err;
  }
}

export default {
  isConfigured: isSarvamConfigured,
  transcribeAudio,
  synthesizeSpeech,
  translateText,
  chatCompletion,
  SARVAM_MODELS,
  SUPPORTED_LANGUAGES
};
