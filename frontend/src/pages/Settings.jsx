import React, { useState, useEffect } from 'react';
import {
  Globe, Key, User, Mic, Shield, Palette, ChevronRight,
  Sun, Moon, Check, Trash2, ToggleLeft, ToggleRight, Volume2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useChatHistory } from '../context/ChatHistoryContext';

const LANGUAGES = [
  { id: 'auto', label: '🔍 Auto-detect', sub: 'Any Indian language', flag: '🔍' },
  { id: 'hi-IN', label: 'हिन्दी', sub: 'Hindi', flag: '🇮🇳' },
  { id: 'en-IN', label: 'English', sub: 'Indian English', flag: '🇮🇳' },
  { id: 'mr-IN', label: 'मराठी', sub: 'Marathi', flag: '🇮🇳' },
  { id: 'ta-IN', label: 'தமிழ்', sub: 'Tamil', flag: '🇮🇳' },
  { id: 'te-IN', label: 'తెలుగు', sub: 'Telugu', flag: '🇮🇳' },
  { id: 'bn-IN', label: 'বাংলা', sub: 'Bengali', flag: '🇮🇳' },
  { id: 'gu-IN', label: 'ગુજરાતી', sub: 'Gujarati', flag: '🇮🇳' },
  { id: 'kn-IN', label: 'ಕನ್ನಡ', sub: 'Kannada', flag: '🇮🇳' },
  { id: 'ml-IN', label: 'മലയാളം', sub: 'Malayalam', flag: '🇮🇳' },
  { id: 'or-IN', label: 'ଓଡ଼ିଆ', sub: 'Odia', flag: '🇮🇳' },
  { id: 'pa-IN', label: 'ਪੰਜਾਬੀ', sub: 'Punjabi', flag: '🇮🇳' },
  { id: 'as-IN', label: 'অসমীয়া', sub: 'Assamese', flag: '🇮🇳' },
  { id: 'ur-IN', label: 'اردو', sub: 'Urdu', flag: '🇮🇳' },
];

const SPEAKERS = [
  { value: 'anushka', label: 'Anushka', sub: 'Female · Hindi' },
  { value: 'abhilash', label: 'Abhilash', sub: 'Male · English' },
  { value: 'manisha', label: 'Manisha', sub: 'Female · Marathi' },
  { value: 'vidya', label: 'Vidya', sub: 'Female · Universal' },
  { value: 'arya', label: 'Arya', sub: 'Female · Tamil' },
  { value: 'karun', label: 'Karun', sub: 'Male · Universal' },
  { value: 'hitesh', label: 'Hitesh', sub: 'Male · Universal' },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Delhi','Jammu & Kashmir',
  'Ladakh','Lakshadweep','Puducherry'
];

const TOPICS = ['Jobs', 'PG Finder', 'Government Schemes', 'Health', 'Education', 'Agriculture', 'Finance'];

const SECTIONS = [
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: Shield },
];

const SavedBadge = ({ show }) => show ? (
  <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
    <Check size={10} /> Saved
  </span>
) : null;

const Toggle = ({ value, onChange, label }) => (
  <button
    onClick={() => onChange(!value)}
    className="flex-shrink-0 transition-colors"
    title={label}
    aria-label={label}
  >
    {value
      ? <ToggleRight size={28} className="text-cyber-cyan" />
      : <ToggleLeft size={28} className="text-white/30" />}
  </button>
);

const Settings = ({
  currentLang, setCurrentLang,
  personality, setPersonality,
  voiceSpeed, setVoiceSpeed,
  apiKey, setApiKey
}) => {
  const { getStorageUsage, deleteAllSessions } = useChatHistory();
  const [activeSection, setActiveSection] = useState('language');
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    setStorageUsed(getStorageUsage());
  }, [getStorageUsage]);

  // Language
  const [secondaryLang, setSecondaryLang] = useState(() => localStorage.getItem('vani_secondary_lang') || 'en-IN');

  // Voice
  const [speaker, setSpeaker] = useState(() => localStorage.getItem('vani_speaker') || 'anushka');
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('vani_autospeak') !== 'false');
  const [vadMode, setVadMode] = useState(() => localStorage.getItem('vani_vad') === 'true');

  // Profile
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vani_profile') || '{}'); } catch { return {}; }
  });

  // API
  const [apiStatus, setApiStatus] = useState(null); // 'session' | 'env' | 'none'

  // Appearance
  const [theme, setTheme] = useState(() => localStorage.getItem('vani_theme') || 'dark');

  // Privacy
  const [saveHistory, setSaveHistory] = useState(() => localStorage.getItem('vani_save_history') !== 'false');
  const [analytics, setAnalytics] = useState(() => localStorage.getItem('vani_analytics') === 'true');

  // Saved badges
  const [saved, setSaved] = useState({});
  const showSaved = (key) => {
    setSaved(p => ({ ...p, [key]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
  };

  const celebrate = () => confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 }, colors: ['#BD00FF', '#00F0FF', '#FFFFFF'] });

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vani_theme', theme);
  }, [theme]);

  // Check API key status
  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => setApiStatus(d.source)).catch(() => {});
  }, []);

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    try {
      await fetch('/api/auth/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: apiKey })
      });
      setApiStatus('session');
      showSaved('api');
      celebrate();
    } catch (err) {
      console.error('Failed to save API key:', err);
    }
  };

  const handleSaveLanguage = () => {
    localStorage.setItem('vani_secondary_lang', secondaryLang);
    showSaved('language');
  };

  const handleSaveVoice = () => {
    localStorage.setItem('vani_speaker', speaker);
    localStorage.setItem('vani_autospeak', String(autoSpeak));
    localStorage.setItem('vani_vad', String(vadMode));
    showSaved('voice');
  };

  const handleSaveProfile = () => {
    localStorage.setItem('vani_profile', JSON.stringify(profile));
    showSaved('profile');
  };

  const handleSavePrivacy = () => {
    localStorage.setItem('vani_save_history', String(saveHistory));
    localStorage.setItem('vani_analytics', String(analytics));
    showSaved('privacy');
  };

  const handleClearAllData = () => {
    if (!confirm('Clear ALL Vani AI local data? This includes your chat history, settings, and profile. This cannot be undone.')) return;
    Object.keys(localStorage).filter(k => k.startsWith('vani_') || k.startsWith('sarvam_')).forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const updateProfile = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  const toggleTopic = (topic) => {
    const topics = profile.topics || [];
    updateProfile('topics', topics.includes(topic) ? topics.filter(t => t !== topic) : [...topics, topic]);
  };

  const sectionContent = {
    language: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">Language Settings</h3>
          <div className="flex items-center gap-2">
            <SavedBadge show={saved.language} />
            <button onClick={handleSaveLanguage} className="px-4 py-1.5 btn-glow text-white text-xs font-bold rounded-lg">Save</button>
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Primary Language</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.id} onClick={() => setCurrentLang(lang.id)}
                className={`px-3 py-3 rounded-xl border text-left transition-all cursor-pointer ${currentLang === lang.id ? 'bg-cyber-cyan/10 border-cyber-cyan text-white' : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:bg-white/8'}`}>
                <p className="font-extrabold text-sm">{lang.label}</p>
                <p className="text-[10px] text-white/30 font-medium">{lang.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Secondary Language (Bridge Mode Target)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.id} onClick={() => setSecondaryLang(lang.id)}
                className={`px-3 py-3 rounded-xl border text-left transition-all cursor-pointer ${secondaryLang === lang.id ? 'bg-cyber-purple/15 border-cyber-neonPurple text-white' : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:bg-white/8'}`}>
                <p className="font-extrabold text-sm">{lang.label}</p>
                <p className="text-[10px] text-white/30 font-medium">{lang.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">AI Persona Style</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'respectful', label: 'Respectful', desc: 'Formal Indian honorifics' },
              { id: 'casual', label: 'Casual Friend', desc: 'Warm & conversational' },
              { id: 'professional', label: 'Professional', desc: 'Business-focused' },
            ].map(p => (
              <button key={p.id} onClick={() => setPersonality(p.id)}
                className={`px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${personality === p.id ? 'bg-cyber-purple/15 border-cyber-neonPurple text-white' : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:bg-white/8'}`}>
                <p className="font-bold text-sm">{p.label}</p>
                <p className="text-[10px] text-white/30">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    ),

    voice: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">Voice Settings</h3>
          <div className="flex items-center gap-2">
            <SavedBadge show={saved.voice} />
            <button onClick={handleSaveVoice} className="px-4 py-1.5 btn-glow text-white text-xs font-bold rounded-lg">Save</button>
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Speaker Voice</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPEAKERS.map(s => (
              <button key={s.value} onClick={() => setSpeaker(s.value)}
                className={`px-3 py-3 rounded-xl border text-left transition-all cursor-pointer ${speaker === s.value ? 'bg-cyber-cyan/10 border-cyber-cyan text-white' : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:bg-white/8'}`}>
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className={speaker === s.value ? 'text-cyber-cyan' : 'text-white/30'} />
                  <div>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-[10px] text-white/30">{s.sub}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Voice Speed</span>
            <span className="text-cyber-cyan text-xs font-bold bg-cyber-cyan/5 px-2 py-0.5 rounded border border-cyber-cyan/15">{voiceSpeed}x</span>
          </div>
          <input
            id="settings-voice-speed"
            name="voiceSpeed"
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
          />
          <div className="flex justify-between text-[10px] text-white/25 mt-1 font-medium">
            <span>Slow (0.5x)</span><span>Fast (2.0x)</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Auto-speak AI Responses</p>
              <p className="text-xs text-white/35 font-medium">Automatically play TTS after each reply</p>
            </div>
            <Toggle value={autoSpeak} onChange={val => { setAutoSpeak(val); localStorage.setItem('vani_autospeak', String(val)); }} label="Toggle Auto-speak AI Responses" />
          </div>
          <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Hands-free VAD Mode</p>
              <p className="text-xs text-white/35 font-medium">Auto-submit after silence (Voice Activity Detection)</p>
            </div>
            <Toggle value={vadMode} onChange={val => { setVadMode(val); localStorage.setItem('vani_vad', String(val)); }} label="Toggle Hands-free VAD Mode" />
          </div>
        </div>
      </div>
    ),

    profile: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">Your Profile</h3>
          <div className="flex items-center gap-2">
            <SavedBadge show={saved.profile} />
            <button onClick={handleSaveProfile} className="px-4 py-1.5 btn-glow text-white text-xs font-bold rounded-lg">Save</button>
          </div>
        </div>
        <p className="text-xs text-white/35 font-medium -mt-2">Personalize AI responses based on your context. All fields optional.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">State / UT</label>
            <select value={profile.state || ''} onChange={e => updateProfile('state', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-cyan/30 transition-all">
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Occupation</label>
            <select value={profile.occupation || ''} onChange={e => updateProfile('occupation', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-cyan/30 transition-all">
              <option value="">Select Occupation</option>
              {['Student', 'Farmer', 'Government Employee', 'Entrepreneur', 'Working Professional', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Age Group</label>
            <select value={profile.age || ''} onChange={e => updateProfile('age', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-cyan/30 transition-all">
              <option value="">Select Age Group</option>
              {['18–25', '26–35', '36–50', '50+'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-2">Preferred Topics</label>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => (
              <button key={topic} onClick={() => toggleTopic(topic)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  (profile.topics || []).includes(topic)
                    ? 'bg-cyber-cyan/15 border-cyber-cyan text-cyber-cyan'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),

    api: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">API Keys</h3>
          <SavedBadge show={saved.api} />
        </div>

        {/* Key status */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${
          apiStatus === 'none' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
          : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
          <span className={`w-2 h-2 rounded-full ${apiStatus === 'none' ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
          {apiStatus === 'none'
            ? '⚠ Simulator Mode — No API key configured'
            : apiStatus === 'session'
            ? '✓ Session key active (Sarvam AI connected)'
            : '✓ Environment key active'}
        </div>

        <p className="text-xs text-white/40 leading-relaxed font-medium">
          By default, Vani AI runs in Simulator Mode with local Web Speech Synthesis. Insert your Sarvam API key to unlock real multilingual AI powered by Saaras v3, Bulbul v2, and sarvam-105B.
        </p>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div>
            <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Sarvam AI Subscription Key</label>
            <input
              id="settings-api-key"
              name="apiKey"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Insert api-subscription-key..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyber-cyan/30 transition-all"
            />
          </div>
          <button type="submit"
            className="w-full btn-glow text-white py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2">
            <Key size={15} />
            Save & Activate Key
          </button>
        </form>
      </div>
    ),

    appearance: (
      <div className="space-y-6">
        <h3 className="text-base font-extrabold text-white">Appearance</h3>

        <div>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Visual Theme</p>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 max-w-xs">
            <button onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'dark' ? 'bg-cyber-purple text-white shadow' : 'text-white/40 hover:text-white'}`}>
              <Moon size={14} /> Cyber Dark
            </button>
            <button onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'light' ? 'bg-white/90 text-gray-900 shadow' : 'text-white/40 hover:text-white'}`}>
              <Sun size={14} /> Modern Light
            </button>
          </div>
          {theme === 'light' && (
            <p className="text-xs text-yellow-400/70 mt-2 font-medium">Note: Light theme is experimental. Full UI support coming soon.</p>
          )}
        </div>
      </div>
    ),

    privacy: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">Privacy Controls</h3>
          <div className="flex items-center gap-2">
            <SavedBadge show={saved.privacy} />
            <button onClick={handleSavePrivacy} className="px-4 py-1.5 btn-glow text-white text-xs font-bold rounded-lg">Save</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Save Conversation History</p>
              <p className="text-xs text-white/35 font-medium">Store chat sessions locally in your browser</p>
            </div>
            <Toggle value={saveHistory} onChange={setSaveHistory} label="Toggle Save Conversation History" />
          </div>
          <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Send Usage Analytics</p>
              <p className="text-xs text-white/35 font-medium">Help improve Vani AI (anonymous, opt-in)</p>
            </div>
            <Toggle value={analytics} onChange={setAnalytics} label="Toggle Send Usage Analytics" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/5">
          <h4 className="text-sm font-bold text-white mb-1">Chat History Storage</h4>
          <p className="text-xs text-white/40 font-medium mb-4">{storageUsed} KB of 5MB used</p>
          <button onClick={() => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
               deleteAllSessions();
               setStorageUsed(getStorageUsage());
            }
          }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer">
            <Trash2 size={14} />
            Clear All Chat History
          </button>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-red-500/15 bg-red-500/5">
          <h4 className="text-sm font-bold text-red-400 mb-1">Danger Zone</h4>
          <p className="text-xs text-white/40 font-medium mb-4">This will permanently delete all your local data — chat history, profile, settings, and API keys.</p>
          <button onClick={handleClearAllData}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer">
            <Trash2 size={14} />
            Clear All Local Data
          </button>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 text-amber-400/80 text-xs font-medium leading-relaxed">
          🔒 Voice recordings are processed client-side or via secure Express relay to Sarvam AI. Your API key is stored in a server-side session — never logged.
        </div>
      </div>
    ),
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left nav */}
      <div className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-white/5 glass-panel p-4 space-y-1">
        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest px-3 mb-2">Settings</p>
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                isActive ? 'bg-cyber-cyan/10 border border-cyber-cyan/20 text-white' : 'text-white/45 hover:text-white hover:bg-white/5 border border-transparent'}`}>
              <Icon size={16} className={isActive ? 'text-cyber-cyan' : 'text-white/35'} />
              {s.label}
              {isActive && <ChevronRight size={14} className="ml-auto text-cyber-cyan/50" />}
            </button>
          );
        })}
      </div>

      {/* Mobile section tabs — scrollable horizontal pill list */}
      <div className="md:hidden flex overflow-x-auto scrollbar-none px-3 py-2 gap-2 border-b border-white/5 flex-shrink-0 absolute top-0 left-0 right-0 z-10 bg-cyber-bg/95 backdrop-blur">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeSection === s.id ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30' : 'text-white/40 bg-white/5 border border-white/5'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 md:pt-8 pt-12">
        <div className="max-w-2xl">
          {sectionContent[activeSection]}
        </div>
      </div>
    </div>
  );
};

export default Settings;
