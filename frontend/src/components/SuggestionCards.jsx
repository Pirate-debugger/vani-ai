import React from 'react';
import { Home, Landmark, Briefcase, HelpCircle, ArrowRight } from 'lucide-react';

const SuggestionCards = ({ onSelect, currentLang, accessibilityMode }) => {
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
    },
    {
      id: 'agriculture',
      icon: Home, // using Home as fallback, wait I can use a generic icon or something else
      title: {
        'hi-IN': 'किसानों के लिए सब्सिडी',
        'en-IN': 'Crop Subsidies & Tips',
        'mr-IN': 'शेतकरी आणि शेती',
        'ta-IN': 'விவசாய மானியங்கள்'
      },
      desc: {
        'hi-IN': 'वर्तमान फसल सब्सिडी, मौसम अपडेट और मंडी भाव जानें।',
        'en-IN': 'Learn about current crop subsidies, weather, and Mandi rates.',
        'mr-IN': 'चालू पीक अनुदान, हवामान आणि बाजारभाव माहिती मिळवा.',
        'ta-IN': 'தற்போதைய பயிர் மானியங்கள் மற்றும் வானிலை.'
      },
      prompt: {
        'hi-IN': 'वर्तमान फसल सब्सिडी क्या हैं?',
        'en-IN': 'What are the current crop subsidies?',
        'mr-IN': 'सध्याचे पीक अनुदान काय आहेत?',
        'ta-IN': 'தற்போதைய பயிர் மானியங்கள் என்ன?'
      },
      color: 'from-green-500/20 to-emerald-500/20',
      badge: '🌾 Agriculture'
    },
    {
      id: 'citizen',
      icon: Landmark,
      title: {
        'hi-IN': 'नागरिक सेवाएं',
        'en-IN': 'Citizen Services',
        'mr-IN': 'नागरी सेवा',
        'ta-IN': 'குடிமக்கள் சேவைகள்'
      },
      desc: {
        'hi-IN': 'आधार अपडेट, पैन कार्ड, और पासपोर्ट के लिए आवेदन कैसे करें।',
        'en-IN': 'How to apply for Aadhar update, PAN card, and Passport.',
        'mr-IN': 'आधार अपडेट आणि पॅन कार्डसाठी अर्ज कसा करावा.',
        'ta-IN': 'ஆதார் திருத்தம் மற்றும் பான் கார்டு.'
      },
      prompt: {
        'hi-IN': 'मैं आधार कार्ड अपडेट के लिए कैसे आवेदन करूं?',
        'en-IN': 'How do I apply for an Aadhar card update?',
        'mr-IN': 'मी आधार कार्ड अपडेटसाठी कसा अर्ज करू?',
        'ta-IN': 'ஆதார் அட்டை திருத்தத்திற்கு நான் எவ்வாறு விண்ணப்பிப்பது?'
      },
      color: 'from-orange-500/20 to-red-500/20',
      badge: '🇮🇳 e-Governance'
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
            className="group relative h-full w-full overflow-hidden rounded-2xl border border-white/5 transition-all duration-300 hover:border-white/10"
          >
            <div className={`p-4 sm:p-5 h-full flex flex-col items-start text-left justify-between bg-gradient-to-br ${card.color} rounded-2xl group-hover:opacity-100 opacity-90 transition-opacity`}>
              <div className="w-full">
                <div className="flex items-center justify-between mb-3 w-full">
                  <span className={`${accessibilityMode ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'} font-extrabold tracking-widest uppercase text-white/50 bg-black/20 px-2 py-0.5 rounded-full`}>
                    {card.badge}
                  </span>
                  <div className="bg-white/10 p-1.5 rounded-lg text-white/70">
                    <Icon size={accessibilityMode ? 20 : 16} />
                  </div>
                </div>
                <h3 className={`${accessibilityMode ? 'text-lg sm:text-xl mb-3' : 'text-sm sm:text-base mb-1.5'} font-bold text-white/95 leading-snug group-hover:text-cyber-cyan transition-colors`}>
                  {cardTitle}
                </h3>
                <p className={`${accessibilityMode ? 'text-sm sm:text-base' : 'text-[11px] sm:text-xs'} text-white/50 font-medium leading-relaxed line-clamp-2`}>
                  {cardDesc}
                </p>
              </div>
              
              <div className={`mt-4 w-full flex items-center justify-between ${accessibilityMode ? 'text-sm' : 'text-[10px]'} font-bold text-cyber-cyan opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0`}>
                <span>Ask Vani</span>
                <ArrowRight size={accessibilityMode ? 16 : 12} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestionCards;
