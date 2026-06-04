import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();

// Setup Multer for handling file uploads in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to check for Sarvam API Key
const getSarvamKey = () => process.env.SARVAM_API_KEY;

/**
 * 1. Speech-to-Text Endpoint (/api/voice/stt)
 * Receives multipart audio file and transcribes it using Sarvam Saaras v3.
 */
router.post('/stt', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    const languageCode = req.body.language_code || 'hi-IN'; // Default to Hindi-India

    if (!file) {
      return res.status(400).json({ error: 'No audio file provided.' });
    }

    const apiKey = getSarvamKey();

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
    // Append the file buffer as a file attachment
    formData.append('file', file.buffer, {
      filename: 'input_audio.wav',
      contentType: file.mimetype || 'audio/wav',
    });
    formData.append('model', 'saaras:v3');
    formData.append('language_code', languageCode);

    const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
      headers: {
        'api-subscription-key': apiKey,
        ...formData.getHeaders()
      }
    });

    return res.json(response.data);

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

    const apiKey = getSarvamKey();

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

    const apiKey = getSarvamKey();

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

export default router;
