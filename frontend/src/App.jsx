import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Assistant from './pages/Assistant';
import Settings from './pages/Settings';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';

const App = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('home');

  // Preferences States (backed by LocalStorage where helpful)
  const [currentLang, setCurrentLang] = useState('hi-IN');
  const [personality, setPersonality] = useState('respectful');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('sarvam_user_key') || '';
  });

  // Conversation Memory Thread
  const [messages, setMessages] = useState([]);

  // Connect to Centralized Voice recording hooks
  const voiceRecorder = useVoiceRecorder(currentLang);

  // Submit prompts to Express backend
  const onSubmitPrompt = async (promptText) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // If a custom key is saved in client preferences, send it down in headers
      if (apiKey) {
        headers['api-subscription-key'] = apiKey;
      }

      // Convert conversation messages format to standard OpenAI structure
      const formattedHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const payload = {
        prompt: promptText,
        messages: [
          ...formattedHistory,
          { role: 'user', content: promptText }
        ],
        language_code: currentLang,
        personality: personality,
        history: formattedHistory
      };

      // Call our Node.js express backend chat route
      const response = await axios.post('/api/ai/chat', payload, { headers });
      return response.data;

    } catch (error) {
      console.error('API submission failed:', error);
      
      // Secondary client-side fallback chatbot if backend is entirely offline
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        response: `[Vani Assistant Offline Fallback]: I received your prompt: "${promptText}". Please ensure the backend Node server is running on port 5000.`,
        simulated: true
      };
    }
  };

  // Clean ongoing syntheses when switching tabs to prevent voice overlaps
  useEffect(() => {
    if (voiceRecorder.cancelSpeech) {
      voiceRecorder.cancelSpeech();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-cyber-bg overflow-hidden text-cyber-text select-none font-sans relative">
      
      {/* Premium Sci-Fi Background Particle Glows */}
      <div className="cyber-bg" />

      {/* Futuristic collapsible Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentLang={currentLang} 
      />

      {/* Main Core View Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        
        {/* Dynamic page tab mounting */}
        {activeTab === 'home' && (
          <Home 
            currentLang={currentLang}
            personality={personality}
            voiceSpeed={voiceSpeed}
            voiceRecorder={voiceRecorder}
            messages={messages}
            setMessages={setMessages}
            onSubmitPrompt={onSubmitPrompt}
          />
        )}

        {activeTab === 'chat' && (
          <Chat 
            currentLang={currentLang}
            voiceSpeed={voiceSpeed}
            voiceRecorder={voiceRecorder}
            messages={messages}
            setMessages={setMessages}
            onSubmitPrompt={onSubmitPrompt}
          />
        )}

        {activeTab === 'assistant' && (
          <Assistant 
            currentLang={currentLang}
            voiceSpeed={voiceSpeed}
            voiceRecorder={voiceRecorder}
            onSubmitPrompt={onSubmitPrompt}
            onEndSession={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'settings' && (
          <Settings 
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
            personality={personality}
            setPersonality={setPersonality}
            voiceSpeed={voiceSpeed}
            setVoiceSpeed={setVoiceSpeed}
            apiKey={apiKey}
            setApiKey={setApiKey}
          />
        )}
      </main>

    </div>
  );
};

export default App;
