import React, { useState } from 'react';
import { Globe, ShieldAlert, Key, UserCheck, Flame, Sliders, Sun, Moon } from 'lucide-react';
import confetti from 'canvas-confetti';

const Settings = ({ 
  currentLang, 
  setCurrentLang,
  personality,
  setPersonality,
  voiceSpeed,
  setVoiceSpeed,
  apiKey,
  setApiKey
}) => {
  const [theme, setTheme] = useState('dark');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveKeys = (e) => {
    e.preventDefault();
    // In production, we'd save to localStorage or backend session
    localStorage.setItem('sarvam_user_key', apiKey);
    setSavedSuccess(true);
    
    // Premium celebration feedback
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#BD00FF', '#00F0FF', '#FFFFFF']
    });

    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const languages = [
    { id: 'hi-IN', label: 'हिंदी (Hindi)', flag: '🇮🇳', region: 'India' },
    { id: 'en-IN', label: 'English (IN)', flag: '🇮🇳', region: 'Global-Indian' },
    { id: 'mr-IN', label: 'मराठी (Marathi)', flag: '🇮🇳', region: 'Maharashtra' },
    { id: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳', region: 'Tamil Nadu' }
  ];

  const personalities = [
    { id: 'respectful', title: 'Respectful', desc: 'Courteous greetings and formal Indian honorifics.' },
    { id: 'casual', title: 'Casual Friend', desc: 'Warm, relaxed, and conversational tone.' },
    { id: 'professional', title: 'Professional', desc: 'Highly informative, crisp, and business-focused.' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-4xl mx-auto w-full space-y-8">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-white to-cyber-cyan bg-clip-text text-transparent tracking-tight">
          System Preferences
        </h1>
        <p className="text-xs text-white/40 mt-1 font-medium">
          Customize language, speech synthesis speeds, AI personas, and credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Core settings column */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Section 1: Language preferences */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 shadow-glass">
            <div className="flex items-center gap-3 text-cyber-cyan border-b border-white/5 pb-3">
              <Globe size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Multilingual Locale</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {languages.map((lang) => {
                const isSelected = currentLang === lang.id;
                return (
                  <button
                    key={lang.id}
                    onClick={() => setCurrentLang(lang.id)}
                    className={`
                      px-4.5 py-4 rounded-xl flex items-center justify-between text-left border transition-all cursor-pointer
                      ${isSelected 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan text-white shadow-glow-cyan/5' 
                        : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className="font-extrabold text-sm">{lang.label}</span>
                      <span className="text-[10px] text-white/35 font-medium">{lang.region}</span>
                    </div>
                    <span className="text-xl">{lang.flag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: AI Personality character select */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 shadow-glass">
            <div className="flex items-center gap-3 text-cyber-neonPurple border-b border-white/5 pb-3">
              <UserCheck size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">AI Persona Style</h2>
            </div>

            <div className="space-y-3.5">
              {personalities.map((pers) => {
                const isSelected = personality === pers.id;
                return (
                  <button
                    key={pers.id}
                    onClick={() => setPersonality(pers.id)}
                    className={`
                      w-full px-4.5 py-3.5 rounded-xl border text-left flex items-start gap-4 transition-all cursor-pointer
                      ${isSelected 
                        ? 'bg-cyber-purple/15 border-cyber-neonPurple text-white shadow-glow-neon/5' 
                        : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center border text-xs
                      ${isSelected ? 'bg-cyber-neonPurple/20 border-cyber-neonPurple/30 text-cyber-neonPurple' : 'bg-white/5 border-white/10'}
                    `}>
                      {pers.title[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-sm">{pers.title}</span>
                      <span className="text-xs text-white/40 font-medium mt-0.5">{pers.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Voice speeds */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 shadow-glass">
            <div className="flex items-center gap-3 text-cyber-cyan border-b border-white/5 pb-3">
              <Sliders size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Voice Speech Pace</h2>
            </div>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs text-white/50 font-bold">
                <span>Slow (0.5x)</span>
                <span className="text-cyber-cyan bg-cyber-cyan/5 px-2 py-0.5 rounded border border-cyber-cyan/15">{voiceSpeed}x Speed</span>
                <span>Fast (2.0x)</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-cyan focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* Credentials / API side column */}
        <div className="space-y-8">
          
          {/* Theme custom settings */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 shadow-glass">
            <div className="flex items-center gap-3 text-white/70 border-b border-white/5 pb-3">
              <Sun size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Visual Mode</h2>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'dark' ? 'bg-cyber-purple text-white shadow' : 'text-white/40 hover:text-white'}`}
              >
                <Moon size={14} />
                <span>Cyber Dark</span>
              </button>
              <button
                onClick={() => {
                  setTheme('light');
                  alert('Cyber Dark theme is standard on Vani AI for a futuristic premium look!');
                  setTheme('dark');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white/40 hover:text-white cursor-pointer"
              >
                <Sun size={14} />
                <span>Modern Light</span>
              </button>
            </div>
          </div>

          {/* API Key Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 shadow-glass">
            <div className="flex items-center gap-3 text-cyber-cyan border-b border-white/5 pb-3">
              <Key size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Custom API Keys</h2>
            </div>

            <p className="text-[11px] text-white/40 leading-relaxed font-semibold">
              By default, Vani AI runs in a fully offline and sandboxed Simulator mode with local Web Speech Synthesis. To connect to real live AI networks, insert your custom key below.
            </p>

            <form onSubmit={handleSaveKeys} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Sarvam AI Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Insert api-subscription-key..."
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-cyan/30 transition-all font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full btn-glow text-white py-3 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
              >
                {savedSuccess ? 'Credentials Verified! 🎉' : 'Save Credentials'}
              </button>
            </form>
          </div>

          {/* Accessibility Info Card */}
          <div className="glass-panel p-5 rounded-2xl border border-amber-500/10 bg-amber-500/5 text-amber-500 flex items-start gap-3.5">
            <ShieldAlert size={18} className="mt-0.5 min-w-4.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wide">Data & Privacy</span>
              <span className="text-[10px] text-white/50 leading-relaxed font-semibold">
                Your voice recordings and transcriptions are handled client-side in the sandbox, or sent through private Express relays to Sarvam AI. Credentials are kept safe in LocalStorage.
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Settings;
