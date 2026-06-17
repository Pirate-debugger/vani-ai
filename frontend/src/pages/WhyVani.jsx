import React from 'react';
import { ArrowLeft, Sparkles, Mic, Globe, Radio, Smartphone, HeartHandshake } from 'lucide-react';

const WhyVani = ({ setActiveTab, accessibilityMode }) => {
  const cards = [
    {
      icon: <Globe size={24} className="text-cyber-cyan" />,
      title: "Built for Bharat",
      desc: "Supporting 23 official Indian languages natively with localized intelligence. Breaking the language barrier for 1.4 billion people."
    },
    {
      icon: <Radio size={24} className="text-cyber-neonPurple" />,
      title: "Real-time Bridge Mode",
      desc: "Live voice-to-voice translation. Speak in Marathi, let the AI reply in English or Tamil in real-time."
    },
    {
      icon: <Mic size={24} className="text-green-400" />,
      title: "Voice-First Architecture",
      desc: "Keyboard-free experience. Entirely powered by Sarvam AI STT & TTS, designed for low-literacy and elderly accessibility."
    },
    {
      icon: <Smartphone size={24} className="text-blue-400" />,
      title: "Mobile Optimized",
      desc: "PWA-ready and responsive. Designed to run smoothly on budget Android smartphones across tier-2 and tier-3 cities."
    },
    {
      icon: <HeartHandshake size={24} className="text-pink-400" />,
      title: "Accessibility Mode",
      desc: "High-contrast colors and dynamically scaling UI elements to assist visually impaired and elderly demographics."
    },
    {
      icon: <Sparkles size={24} className="text-amber-400" />,
      title: "Conversational Memory",
      desc: "Maintains full context across languages. Switch from Hindi to English seamlessly without losing track of the dialogue."
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-y-auto w-full relative bg-cyber-bg pb-16 md:pb-0">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,255,0.05)_0%,transparent_50%)] pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 backdrop-blur-md">
        <button 
          onClick={() => setActiveTab('home')}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-cyber-cyan animate-pulse" />
          <h2 className={`${accessibilityMode ? 'text-2xl' : 'text-lg sm:text-xl'} font-extrabold text-white tracking-wide`}>Why Vani AI?</h2>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className={`${accessibilityMode ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'} font-black bg-gradient-to-br from-white via-white to-cyber-cyan bg-clip-text text-transparent`}>
            Empowering 1.4 Billion Voices
          </h1>
          <p className={`${accessibilityMode ? 'text-lg md:text-xl mt-6' : 'text-base md:text-lg'} text-white/50 max-w-2xl mx-auto font-medium`}>
            Vani AI is a production-grade, multilingual voice intelligence platform engineered to eradicate language, literacy, and accessibility barriers in India.
          </p>
        </div>

        {/* Competitive Advantages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cards.map((card, idx) => (
            <div key={idx} className="glass-panel border-white/5 p-6 sm:p-8 rounded-2xl hover:border-cyber-cyan/30 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10 group-hover:bg-white/10 transition-colors">
                {card.icon}
              </div>
              <h3 className={`${accessibilityMode ? 'text-xl' : 'text-lg'} font-bold text-white mb-2 group-hover:text-cyber-cyan transition-colors`}>
                {card.title}
              </h3>
              <p className={`${accessibilityMode ? 'text-base' : 'text-sm'} text-white/60 leading-relaxed font-medium`}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Use Cases Section */}
        <div className="glass-panel border-cyber-purple/20 bg-cyber-purple/5 p-6 sm:p-10 rounded-3xl mt-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyber-purple/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          <h2 className={`${accessibilityMode ? 'text-3xl' : 'text-2xl'} font-black text-white mb-6 relative z-10`}>Real-World Impact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
            <div className="space-y-2">
              <h4 className="text-cyber-cyan font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyber-cyan" /> Education</h4>
              <p className="text-sm text-white/60 font-medium">An AI Tutor for rural students to ask science questions in Marathi or Odia without typing.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-green-400 font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Agriculture</h4>
              <p className="text-sm text-white/60 font-medium">Farmers accessing real-time mandi prices and crop disease advice in Punjabi or Telugu.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-amber-400 font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> e-Governance</h4>
              <p className="text-sm text-white/60 font-medium">Navigating complex Aadhar or PM-JAY documentation through simple conversational Hindi.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-pink-400 font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-pink-400" /> Healthcare</h4>
              <p className="text-sm text-white/60 font-medium">Symptom checking and medicine schedule reminders for the elderly in their native dialect.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyVani;
