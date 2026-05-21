import React from 'react';
import { Home, Landmark, Briefcase, HelpCircle, ArrowRight } from 'lucide-react';

const SuggestionCards = ({ onSelect, currentLang }) => {
  const cards = [
    {
      id: 'pg',
      icon: Home,
      title: {
        'hi-IN': 'आस-पास PG खोजें',
        'en-IN': 'Find a PG Nearby',
        'mr-IN': 'जवळपास PG शोधा',
        'ta-IN': 'பிஜி தங்குமிடம் தேட'
      },
      desc: {
        'hi-IN': 'अपने कार्यालय या कॉलेज के पास हॉस्टल और पेइंग गेस्ट खोजें।',
        'en-IN': 'Locate premium PG and co-living facilities near your work.',
        'mr-IN': 'तुमच्या ऑफिस किंवा कॉलेज जवळ पीजी किंवा हॉस्टेल शोधा.',
        'ta-IN': 'உங்கள் அலுவலகத்திற்கு அருகில் சிறந்த தங்குமிடங்கள்.'
      },
      prompt: {
        'hi-IN': 'आस-पास रहने के लिए एक अच्छा और किफायती पीजी ढूंढें।',
        'en-IN': 'Find a PG nearby',
        'mr-IN': 'जवळपास राहण्यासाठी पीजी आणि हॉस्टेल चे पर्याय दाखवा.',
        'ta-IN': 'அருகிலுள்ள தங்குவதற்கு தகுதியான பிஜி விவரங்கள் வேண்டும்.'
      },
      color: 'from-blue-500/20 to-cyber-cyan/20',
      badge: '🏡 PG/Co-Living'
    },
    {
      id: 'schemes',
      icon: Landmark,
      title: {
        'hi-IN': 'सरकारी योजनाएं',
        'en-IN': 'Government Schemes',
        'mr-IN': 'सरकारी योजना',
        'ta-IN': 'அரசு நலத்திட்டங்கள்'
      },
      desc: {
        'hi-IN': 'मुद्रा लोन, जन धन और स्वास्थ्य बीमा की पूरी जानकारी प्राप्त करें।',
        'en-IN': 'Learn about Mudra loans, PM-JAY health insurance, and subsidies.',
        'mr-IN': 'मुद्रा लोन, जनधन आणि लाडकी बहीण योजनांबद्दल संपूर्ण माहिती.',
        'ta-IN': 'முத்ரா கடன், காப்பீடு போன்ற அரசு உதவிகளை அறிய.'
      },
      prompt: {
        'hi-IN': 'बताएं कि मुझे कौन सी सरकारी योजनाओं का लाभ मिल सकता है।',
        'en-IN': 'Tell me about government schemes',
        'mr-IN': 'मला महत्त्वाच्या सरकारी योजनांबद्दल माहिती सांगा.',
        'ta-IN': 'அரசு திட்டங்கள் மற்றும் அதன் பயன்கள் பற்றி கூறுங்கள்.'
      },
      color: 'from-amber-500/20 to-red-500/20',
      badge: '📜 Welfare/Loans'
    },
    {
      id: 'jobs',
      icon: Briefcase,
      title: {
        'hi-IN': 'फ्रेशर्स के लिए जॉब्स',
        'en-IN': 'Jobs for Freshers',
        'mr-IN': 'फ्रेशर्स नोकरी',
        'ta-IN': 'புதியவர்களுக்கான வேலை'
      },
      desc: {
        'hi-IN': 'शीर्ष स्टार्टअप और आईटी कंपनियों में नवीनतम रिक्तियां।',
        'en-IN': 'Search entry-level job roles in tech, support, and operations.',
        'mr-IN': 'स्टार्टअप्स आणि आयटी कंपन्यांमधील नवीनतम नोकरीच्या संधी.',
        'ta-IN': 'ஐடி மற்றும் பிற நிறுவனங்களின் தற்போதைய வேலை வாய்ப்புகள்.'
      },
      prompt: {
        'hi-IN': 'फ्रेशर्स के लिए उपलब्ध नौकरियां और जॉब वेकेंसी दिखाएं।',
        'en-IN': 'Jobs for freshers',
        'mr-IN': 'फ्रेशर्स साठी चालू असलेल्या नोकऱ्यांबद्दल माहिती सांगा.',
        'ta-IN': 'புதியவர்களுக்கான சிறந்த வேலை வாய்ப்புகளை காட்டுங்கள்.'
      },
      color: 'from-emerald-500/20 to-cyber-cyan/20',
      badge: '💼 Career'
    },
    {
      id: 'help',
      icon: HelpCircle,
      title: {
        'hi-IN': 'सामान्य सहायता',
        'en-IN': 'General Assistance',
        'mr-IN': 'सामान्य मदत',
        'ta-IN': 'பொதுவான உதவி'
      },
      desc: {
        'hi-IN': 'दैनिक कार्य, अनुवाद, ईमेल ड्राफ्टिंग और त्वरित प्रश्नों के उत्तर।',
        'en-IN': 'Get translations, email templates, calculations, and general tips.',
        'mr-IN': 'मजकूर भाषांतर, ईमेल ड्राफ्टिंग किंवा कोणत्याही शंकांचे निरसन.',
        'ta-IN': 'மொழிபெயர்ப்பு, மின்னஞ்சல் மற்றும் பிற பொது விபரங்கள்.'
      },
      prompt: {
        'hi-IN': 'आप मेरी किन कामों में और कैसे मदद कर सकते हैं?',
        'en-IN': 'How can you help me today?',
        'mr-IN': 'तुम्ही मला कोणत्या प्रकारे मदत करू शकता?',
        'ta-IN': 'நீங்கள் எனக்கு எவ்வாறெல்லாம் உதவ முடியும்?'
      },
      color: 'from-cyber-purple/20 to-pink-500/20',
      badge: '💬 AI Brain'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl px-4 mt-8">
      {cards.map((card) => {
        const Icon = card.icon;
        const cardTitle = card.title[currentLang] || card.title['en-IN'];
        const cardDesc = card.desc[currentLang] || card.desc['en-IN'];
        const cardPrompt = card.prompt[currentLang] || card.prompt['en-IN'];

        return (
          <button
            key={card.id}
            onClick={() => onSelect(cardPrompt)}
            className="flex flex-col text-left glass-panel glass-panel-hover p-6 rounded-2xl group border border-white/5 relative overflow-hidden transition-all duration-300"
          >
            {/* Background Glow Mesh overlay */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-40 blur-xl group-hover:scale-125 transition-transform duration-300 z-0`} />
            
            {/* Upper Badge */}
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyber-cyan mb-4 z-10">{card.badge}</span>
            
            {/* Icon Wrapper */}
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10 group-hover:border-cyber-cyan/30 transition-all z-10">
              <Icon size={22} className="text-white group-hover:text-cyber-cyan transition-colors" />
            </div>
            
            {/* Details */}
            <h3 className="font-extrabold text-base text-white group-hover:text-cyber-cyan transition-colors mb-2 z-10 leading-tight">{cardTitle}</h3>
            <p className="text-xs text-white/50 leading-relaxed font-medium mb-6 z-10 flex-1">{cardDesc}</p>
            
            {/* Quick Action arrow */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/40 group-hover:text-cyber-cyan transition-colors z-10">
              <span>Ask Vani</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestionCards;
