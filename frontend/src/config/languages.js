/**
 * Canonical Frontend Language Registry for Vani AI
 * Maps to Sarvam AI STT, TTS, and Translation capabilities
 */

export const LANGUAGES = [
  {
    code: 'hi-IN',
    label: 'हिन्दी',
    englishName: 'Hindi',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'en-IN',
    label: 'English',
    englishName: 'English (India)',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'bn-IN',
    label: 'বাংলা',
    englishName: 'Bengali',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'ta-IN',
    label: 'தமிழ்',
    englishName: 'Tamil',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'te-IN',
    label: 'తెలుగు',
    englishName: 'Telugu',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'mr-IN',
    label: 'मराठी',
    englishName: 'Marathi',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'gu-IN',
    label: 'ગુજરાતી',
    englishName: 'Gujarati',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'kn-IN',
    label: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'ml-IN',
    label: 'മലയാളം',
    englishName: 'Malayalam',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'pa-IN',
    label: 'ਪੰਜਾਬੀ',
    englishName: 'Punjabi',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  },
  {
    code: 'od-IN',
    label: 'ଓଡ଼ିଆ',
    englishName: 'Odia',
    flag: '🇮🇳',
    stt: true,
    tts: true,
    translation: true
  }
];

export function getLanguage(code) {
  if (!code) return LANGUAGES[0];
  const normalized = code.toLowerCase().trim();
  return LANGUAGES.find(l => 
    l.code.toLowerCase() === normalized || 
    l.code.split('-')[0] === normalized.split('-')[0]
  ) || LANGUAGES[0];
}

export default LANGUAGES;
