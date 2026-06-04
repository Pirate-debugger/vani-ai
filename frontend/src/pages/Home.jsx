import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, VolumeX, ArrowRight, CornerDownLeft } from 'lucide-react';
import VoiceOrb from '../components/VoiceOrb';
import SuggestionCards from '../components/SuggestionCards';

const Home = ({ 
  currentLang, 
  personality, 
  voiceSpeed,
  voiceRecorder, 
  messages, 
  setMessages,
  onSubmitPrompt 
}) => {
  const [statusText, setStatusText] = useState('How can Vani AI help you today?');
  const [orbState, setOrbState] = useState('idle'); // idle, listening, thinking, speaking
  const [textInput, setTextInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Fix: ref so async callbacks always read the latest orbState (no stale closure)
  const orbStateRef = useRef('idle');
  const setOrbStateSafe = (s) => {
    orbStateRef.current = s;
    setOrbState(s);
  };

  const {
    isRecording,
    transcript,
    liveTranscript,
    audioBlob,
    audioAnalyser,
    startRecording,
    stopRecording,
    speakWithTTS,
    cancelSpeech
  } = voiceRecorder;

  // Handle listening state changes
  useEffect(() => {
    if (isRecording) {
      setOrbStateSafe('listening');
      setStatusText('Listening to you...');
      cancelSpeech();
    } else {
      // Only transition if we were listening (avoid overriding thinking/speaking)
      if (orbStateRef.current === 'listening') {
        setOrbStateSafe('thinking');
        setStatusText('Vani AI is thinking...');
      }
    }
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle final recording STT submission
  useEffect(() => {
    const handleVoiceSubmission = async () => {
      if (!audioBlob) return;
      
      setIsAiThinking(true);
      setOrbState('thinking');
      setStatusText('Processing your speech...');

      // Let's grab the transcript we got from our browser SpeechRecognition (or fall back to server)
      const spokenText = transcript.trim() || liveTranscript.trim();
      
      if (!spokenText) {
        setStatusText('Sorry, I couldn\'t hear anything. Try again!');
        setOrbState('idle');
        setIsAiThinking(false);
        return;
      }

      console.log('Voice submitted text:', spokenText);
      await processPrompt(spokenText);
    };

    handleVoiceSubmission();
  }, [audioBlob]);

  // Process text prompt and generate responses
  const processPrompt = async (promptText) => {
    if (!promptText.trim()) return;
    
    setIsAiThinking(true);
    setOrbStateSafe('thinking');
    setStatusText('Thinking...');

    // Save user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setTextInput('');

    try {
      // Call backend Chat API
      const aiResponse = await onSubmitPrompt(promptText);

      // Save AI Response
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: aiResponse.simulated
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Let AI speak back
      setOrbStateSafe('speaking');
      setStatusText('Vani AI is speaking...');

      // Prefer backend Sarvam TTS audio, fall back to browser synthesis
      if (aiResponse.audio_content) {
        const audio = new Audio(`data:audio/wav;base64,${aiResponse.audio_content}`);
        audio.play();
        audio.onended = () => {
          setOrbStateSafe('idle');
          setStatusText('How can Vani AI help you today?');
        };
      } else {
        // speakWithTTS: tries Sarvam /api/voice/tts first, then browser fallback
        speakWithTTS(aiResponse.response, currentLang, voiceSpeed, () => {
          setOrbStateSafe('idle');
          setStatusText('How can Vani AI help you today?');
        });
      }

    } catch (err) {
      console.error('Failed to get AI response:', err);
      setStatusText('Connection error. Please check your setup!');
      setOrbStateSafe('idle');
    } finally {
      setIsAiThinking(false);
    }
  };

  // Toggle Microphone
  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Stop vocal response manually
  const handleSilenceClick = () => {
    cancelSpeech();
    setOrbStateSafe('idle');
    setStatusText('How can Vani AI help you today?');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 md:p-12 overflow-y-auto max-w-6xl mx-auto w-full space-y-8">
      
      {/* Top Welcome Title */}
      <div className="text-center mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyber-purple/30 bg-cyber-purple/10 rounded-full text-xs font-semibold text-cyber-cyan shadow-glow-cyan/5 mb-4">
          <Sparkles size={12} className="animate-spin" />
          <span>Multilingual Voice assistant v3.0</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-white/80 to-cyber-cyan bg-clip-text text-transparent tracking-tight leading-tight">
          {statusText}
        </h1>
        <p className="text-sm text-white/40 mt-2 font-medium">
          Say anything in Hindi, Marathi, Tamil, or English to begin.
        </p>
      </div>

      {/* Main Glowing AI Orb Visualizer */}
      <div className="w-full flex flex-col items-center justify-center relative min-h-[300px]">
        <div className="w-72 h-72 relative">
          <VoiceOrb 
            state={orbState} 
            isListening={isRecording} 
            audioAnalyser={audioAnalyser} 
          />
        </div>

        {/* Floating Voice wave text overlay */}
        {(isRecording && liveTranscript) && (
          <div className="absolute -bottom-8 max-w-lg w-full bg-cyber-card border border-white/5 backdrop-blur-md px-6 py-3 rounded-2xl text-center shadow-glow-cyan/5 text-sm text-cyber-cyan/95 font-medium animate-pulse">
            "{liveTranscript}"
          </div>
        )}

        {/* Prompt processing loader overlay */}
        {isAiThinking && (
          <div className="absolute -bottom-8 flex items-center gap-2 bg-cyber-card border border-cyber-purple/20 px-6 py-3 rounded-2xl text-sm text-cyber-neonPurple font-bold shadow-glow-purple/10">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neonPurple opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-neonPurple"></span>
            </span>
            <span>Synthesizing Response...</span>
          </div>
        )}
      </div>

      {/* Controls Container */}
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 mt-8 z-10">
        
        {/* Interactive Bar */}
        <div className="flex items-center justify-center gap-4">
          {/* Silence Button */}
          {orbState === 'speaking' && (
            <button
              onClick={handleSilenceClick}
              className="w-12 h-12 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-red-500/5 hover:scale-105"
              title="Stop speaking"
            >
              <VolumeX size={20} />
            </button>
          )}

          {/* Trigger Mic Button */}
          <button
            onClick={handleMicClick}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative group
              ${isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' 
                : 'btn-glow text-white shadow-glow-neon'}
            `}
          >
            {isRecording ? (
              <MicOff size={28} className="animate-pulse" />
            ) : (
              <Mic size={28} className="group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>

        {/* Text Input combo box */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            processPrompt(textInput);
          }}
          className="w-full relative flex items-center glass-panel border border-white/5 p-1.5 rounded-2xl shadow-glass focus-within:border-cyber-cyan/30 transition-all max-w-lg"
        >
          <input 
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-white/90 focus:outline-none placeholder-white/35 font-medium"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="p-3 bg-cyber-purple hover:bg-cyber-purple/80 disabled:opacity-40 disabled:hover:bg-cyber-purple text-white rounded-xl transition-all flex items-center justify-center cursor-pointer"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* suggestion cards row */}
      {messages.length === 0 && (
        <div className="w-full flex flex-col items-center pt-8 border-t border-white/5">
          <span className="text-xs uppercase font-extrabold tracking-widest text-white/30 mb-2">Popular suggestions</span>
          <SuggestionCards onSelect={processPrompt} currentLang={currentLang} />
        </div>
      )}
    </div>
  );
};

export default Home;
