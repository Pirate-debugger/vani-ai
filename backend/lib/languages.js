/**
 * Canonical Language Registry for Vani AI
 * Grounded in Sarvam AI production API capabilities (Saaras v4 STT, Bulbul v3 TTS, Mayura v1 Translation)
 */

export const LANGUAGE_REGISTRY = [
  {
    code: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'en-IN',
    englishName: 'English (India)',
    nativeName: 'English',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'neha'
  },
  {
    code: 'bn-IN',
    englishName: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'kavitha'
  },
  {
    code: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'mr-IN',
    englishName: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'ritu'
  },
  {
    code: 'gu-IN',
    englishName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'pa-IN',
    englishName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: true,
    defaultSpeaker: 'priya'
  },
  {
    code: 'od-IN',
    englishName: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true,
    codemix: false,
    defaultSpeaker: 'priya'
  }
];

export const SUPPORTED_LANGUAGE_CODES = LANGUAGE_REGISTRY.map(l => l.code);

export function getLanguageByCode(code) {
  if (!code) return LANGUAGE_REGISTRY[0];
  const normalized = code.toLowerCase().trim();
  return LANGUAGE_REGISTRY.find(l => 
    l.code.toLowerCase() === normalized || 
    l.code.split('-')[0] === normalized.split('-')[0]
  ) || LANGUAGE_REGISTRY[0];
}

export default {
  LANGUAGE_REGISTRY,
  SUPPORTED_LANGUAGE_CODES,
  getLanguageByCode
};
