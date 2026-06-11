import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import prisma from '../lib/prisma.js';
import { decryptKey } from '../lib/crypto.js';

const router = express.Router();

// Setup Multer for handling file uploads in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      const err = new Error('Only audio files are accepted');
      err.status = 415;
      cb(err, false);
    }
  }
});

// Helper to resolve Sarvam API key — request cache first, then DB, then env
const getSarvamKey = async (req) => {
  if (req.cachedSarvamKey) return req.cachedSarvamKey;

  const user = req.user || req.session?.localUser;
  if (user && user.id) {
    try {
      const apiKeyRow = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'sarvam' } }
      });
      if (apiKeyRow && apiKeyRow.encryptedKey) {
        const decrypted = decryptKey(apiKeyRow.encryptedKey);
        req.cachedSarvamKey = decrypted;
        return decrypted;
      }
    } catch (err) {
      console.error('Error fetching API key from DB:', err);
    }
  }

  return process.env.SARVAM_API_KEY;
};

/**
 * 1. Speech-to-Text Endpoint (/api/voice/stt)
 * Receives multipart audio file and transcribes it using Sarvam Saaras v3.
 */
router.post('/stt', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    const languageCode = req.body.language_code || 'hi-IN';

    if (!file) {
      return res.status(400).json({ error: 'No audio file provided.' });
    }

    const apiKey = await getSarvamKey(req);

    if (!apiKey) {
      // --- SIMULATOR MODE FALLBACK ---
      console.log(`[STT Simulator] Received audio of size: ${file.size} bytes. Language: ${languageCode}`);
      // Simulate transcription delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Standard Indian locale fallback prompts
      const fallbacks = {
        'hi-IN': 'नमस्ते, मुझे एक अच्छा पीजी ढूंढना है।',
        'en-IN': 'Hello, I want to find a job or look for government schemes.',
        'mr-IN': 'नमस्कार, मला नवीन सरकारी योजनांबद्दल माहिती हवी आहे.',
        'ta-IN': 'வணக்கம், எனக்கு தங்குவதற்கு நல்ல பிஜி வேண்டும்.'
      };

      return res.json({
        transcript: fallbacks[languageCode] || fallbacks['en-IN'],
        model: 'saaras:v3-simulated',
        language_code: languageCode,
        confidence: 0.96,
        simulated: true
      });
    }

    // --- PRODUCTION SARVAM STT CALL ---
    console.log(`[STT Production] Processing audio via Sarvam Saaras v3. Language: ${languageCode}`);
    
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: 'input_audio.wav',
      contentType: file.mimetype || 'audio/wav',
    });
    formData.append('model', 'saaras:v3');
    // Support 'auto' for automatic language detection
    const sttLang = languageCode === 'auto' ? 'unknown' : languageCode;
    formData.append('language_code', sttLang);

    const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
      headers: {
        'api-subscription-key': apiKey,
        ...formData.getHeaders()
      }
    });

    return res.json({
      ...response.data,
      detected_language: response.data.language_code || languageCode,
      requested_language: languageCode
    });

  } catch (error) {
    console.error('Sarvam STT Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Sarvam Speech-to-Text API Failed',
      details: error.response?.data || error.message
    });
  }
});

/**
 * 2. Text-to-Speech Endpoint (/api/voice/tts)
 * Receives text and returns synthesized audio via Sarvam Bulbul v2.
 */
router.post('/tts', async (req, res, next) => {
  try {
    const { text, target_language_code, speaker, speed } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text content is required for voice generation.' });
    }

    const langCode = target_language_code || 'hi-IN';
    const chosenPace = speed ? parseFloat(speed) : 1.0;

    // Valid speakers for bulbul:v2: anushka, abhilash, manisha, vidya, arya, karun, hitesh
    // Pick a good default per language
    let defaultSpeaker = 'anushka'; // Female Hindi — works for most Indian languages
    if (langCode.startsWith('ta')) defaultSpeaker = 'arya';
    else if (langCode.startsWith('en')) defaultSpeaker = 'abhilash';
    else if (langCode.startsWith('mr')) defaultSpeaker = 'manisha';
    const chosenSpeaker = speaker || defaultSpeaker;

    const apiKey = await getSarvamKey(req);

    if (!apiKey) {
      // --- SIMULATOR MODE FALLBACK ---
      console.log(`[TTS Simulator] Generating voice for: "${text.substring(0, 30)}..." in ${langCode}`);
      
      // We will signal the front-end to use its client-side Web Speech API Synthesis fallback,
      // which is incredibly fast, zero latency, and speaks in the correct local accent!
      return res.json({
        audio_content: null,
        simulated: true,
        text: text,
        language_code: langCode,
        message: 'Simulator mode active. Client-side Web Speech API Synthesis is recommended for local voice feedback.'
      });
    }

    // --- PRODUCTION SARVAM TTS CALL ---
    console.log(`[TTS Production] Synthesizing speech via Sarvam Bulbul v2: "${text.substring(0, 30)}..."`);
    
    const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
      text: text,
      target_language_code: langCode,
      speaker: chosenSpeaker,
      model: 'bulbul:v2',
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      pace: chosenPace
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const sarvamData = response.data;
    // Sarvam returns { audios: [base64wav, ...] } — normalize to audio_content
    const audioContent = sarvamData.audios?.[0] || sarvamData.audio_content || null;

    return res.json({
      audio_content: audioContent,
      language_code: langCode,
      speaker: chosenSpeaker,
      model: 'bulbul:v2',
      simulated: false
    });

  } catch (error) {
    console.error('Sarvam TTS Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Sarvam Text-to-Speech API Failed',
      details: error.response?.data || error.message
    });
  }
});

/**
 * 3. Translation Endpoint (/api/voice/translate)
 * Translates texts across Indian languages using Sarvam Mayura v1.
 */
router.post('/translate', async (req, res, next) => {
  try {
    const { input, source_language_code, target_language_code, mode } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required for translation.' });
    }

    const srcLang = source_language_code || 'auto';
    const tgtLang = target_language_code || 'hi-IN';
    const translationMode = mode || 'formal';

    const apiKey = await getSarvamKey(req);

    if (!apiKey) {
      // --- SIMULATOR MODE FALLBACK ---
      console.log(`[Translation Simulator] Translating: "${input.substring(0, 35)}" from ${srcLang} to ${tgtLang}`);
      
      // Basic rules/mock translation dictionary for clean dashboard demo
      const mockDictionary = {
        'Find a PG nearby': {
          'hi-IN': 'आस-पास एक पीजी (Paying Guest) खोजें।',
          'mr-IN': 'जवळपास पीजी (Paying Guest) शोधा.',
          'ta-IN': 'அருகிலுள்ள ஒரு பிஜி தங்குமிடத்தைக் கண்டறியவும்.'
        },
        'Tell me about government schemes': {
          'hi-IN': 'मुझे सरकारी योजनाओं के बारे में बताएं।',
          'mr-IN': 'मला सरकारी योजनांबद्दल सांगा.',
          'ta-IN': 'அரசு திட்டங்கள் பற்றி எனக்கு கூறுங்கள்.'
        },
        'Jobs for freshers': {
          'hi-IN': 'फ्रेशर्स के लिए उपलब्ध नौकरियां।',
          'mr-IN': 'फ्रेशर्ससाठी नोकऱ्या.',
          'ta-IN': 'புதியவர்களுக்கான வேலைகள்.'
        }
      };

      let translatedText = `[Simulated Translation to ${tgtLang}]: ${input}`;
      if (mockDictionary[input] && mockDictionary[input][tgtLang]) {
        translatedText = mockDictionary[input][tgtLang];
      }

      return res.json({
        translated_text: translatedText,
        source_language_code: srcLang,
        target_language_code: tgtLang,
        model: 'mayura:v1-simulated',
        simulated: true
      });
    }

    // --- PRODUCTION SARVAM TRANSLATION CALL ---
    console.log(`[Translation Production] Translating via Sarvam Mayura v1...`);

    const response = await axios.post('https://api.sarvam.ai/translate', {
      input: input,
      source_language_code: srcLang,
      target_language_code: tgtLang,
      model: 'mayura:v1',
      mode: translationMode
    }, {
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return res.json(response.data);

  } catch (error) {
    console.error('Sarvam Translation Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Sarvam Translate API Failed',
      details: error.response?.data || error.message
    });
  }
});

/**
 * 4. Bridge Mode Endpoint (/api/voice/bridge)
 * Full bilingual pipeline: STT(sourceLang) → Translate → LLM(targetLang) → TTS(targetLang)
 */
router.post('/bridge', async (req, res, next) => {
  req.on('close', () => {
    console.log('[Bridge] Client disconnected prematurely');
  });

  const STEP_TIMEOUT = 15000; // 15 seconds per step

  try {
    const { audioBase64, sourceLang, targetLang, mimeType } = req.body;
    const apiKey = await getSarvamKey(req);

    if (!apiKey) {
      return res.status(400).json({
        error: 'No API key configured. Please add your Sarvam key in Settings.',
        simulated: true
      });
    }
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required.' });

    // Step 1: STT in sourceLang
    let transcript;
    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
      const sttForm = new FormData();
      sttForm.append('file', audioBuffer, {
        filename: `input.${ext}`,
        contentType: mimeType || 'audio/webm'
      });
      sttForm.append('model', 'saaras:v3');
      sttForm.append('language_code', sourceLang);
      const sttRes = await axios.post('https://api.sarvam.ai/speech-to-text', sttForm, {
        headers: { 'api-subscription-key': apiKey, ...sttForm.getHeaders() },
        timeout: STEP_TIMEOUT
      });
      transcript = sttRes.data.transcript;
    } catch (err) {
      throw new Error(`Bridge step failed at STT: ${err.message}`);
    }

    // Step 2: Translate sourceLang → targetLang
    let translatedText;
    try {
      const translateRes = await axios.post('https://api.sarvam.ai/translate', {
        input: transcript,
        source_language_code: sourceLang,
        target_language_code: targetLang,
        model: 'mayura:v1',
        mode: 'formal'
      }, { 
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
        timeout: STEP_TIMEOUT
      });
      translatedText = translateRes.data.translated_text;
    } catch (err) {
      throw new Error(`Bridge step failed at Translate: ${err.message}`);
    }

    // Step 3: LLM response in targetLang
    let llmReply;
    try {
      const llmRes = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
        model: 'sarvam-105b',
        messages: [
          {
            role: 'system',
            content: `You are Vani AI. Reply in the language of code "${targetLang}". Keep replies under 4 sentences, suitable for voice output.`
          },
          { role: 'user', content: translatedText }
        ],
        max_tokens: 300,
        temperature: 0.7
      }, { 
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
        timeout: STEP_TIMEOUT
      });
      llmReply = llmRes.data.choices[0].message.content;
    } catch (err) {
      throw new Error(`Bridge step failed at LLM: ${err.message}`);
    }

    // Step 4: TTS in targetLang
    let audioContent;
    try {
      let defaultSpeaker = 'anushka';
      if (targetLang.startsWith('ta')) defaultSpeaker = 'arya';
      else if (targetLang.startsWith('en')) defaultSpeaker = 'abhilash';
      else if (targetLang.startsWith('mr')) defaultSpeaker = 'manisha';

      const ttsRes = await axios.post('https://api.sarvam.ai/text-to-speech', {
        text: llmReply.substring(0, 500),
        target_language_code: targetLang,
        speaker: defaultSpeaker,
        model: 'bulbul:v2',
        speech_sample_rate: 22050,
        enable_preprocessing: true
      }, { 
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
        timeout: STEP_TIMEOUT
      });
      audioContent = ttsRes.data.audios?.[0] || null;
    } catch (err) {
      throw new Error(`Bridge step failed at TTS: ${err.message}`);
    }

    return res.json({ transcript, translatedText, llmReply, audioContent, sourceLang, targetLang });
  } catch (err) {
    console.error('Bridge Mode Error:', err.response?.data || err.message);
    next(err);
  }
});

export default router;
