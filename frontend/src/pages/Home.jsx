import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, VolumeX } from 'lucide-react';
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
  const [orbState, setOrbState]     = useState('idle');
  const [textInput, setTextInput]   = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const orbStateRef = useRef('idle');
  const setOrbStateSafe = (s) => { orbStateRef.current = s; setOrbState(s); };

  const {
    isRecording, transcript, liveTranscript, audioBlob,
    audioAnalyser, startRecording, stopRecording, speakWithTTS, cancelSpeech
  } = voiceRecorder;

  useEffect(() => {
    if (isRecording) {
      setOrbStateSafe('listening');
      setStatusText('Listening to you...');
      cancelSpeech();
    } else {
      if (orbStateRef.current === 'listening') {
        setOrbStateSafe('thinking');
        setStatusText('Vani AI is thinking...');
      }
    }
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleVoiceSubmission = async () => {
      if (!audioBlob) return;
      setIsAiThinking(true);
      setOrbState('thinking');
      setStatusText('Processing your speech...');
      const spokenText = transcript.trim() || liveTranscript.trim();
      if (!spokenText) {
        setStatusText("Sorry, I couldn't hear anything. Try again!");
        setOrbState('idle');
        setIsAiThinking(false);
        return;
      }
      await processPrompt(spokenText);
    };
    handleVoiceSubmission();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  const processPrompt = async (promptText) => {
    if (!promptText.trim()) return;
    setIsAiThinking(true);
    setOrbStateSafe('thinking');
    setStatusText('Thinking...');

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMessage]);
    setTextInput('');

    try {
      const aiResponse = await onSubmitPrompt(promptText);
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: aiResponse.simulated
      };
      setMessages(prev => [...prev, aiMessage]);
      setOrbStateSafe('speaking');
      setStatusText('Vani AI is speaking...');
      if (aiResponse.audio_content) {
        const audio = new Audio(`data:audio/wav;base64,${aiResponse.audio_content}`);
        audio.play();
        audio.onended = () => { setOrbStateSafe('idle'); setStatusText('How can Vani AI help you today?'); };
      } else {
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

  const handleMicClick = () => { if (isRecording) stopRecording(); else startRecording(); };
  const handleSilenceClick = () => { cancelSpeech(); setOrbStateSafe('idle'); setStatusText('How can Vani AI help you today?'); };

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto w-full">
      
      {/* Hero Section */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyber-purple/30 bg-cyber-purple/10 rounded-full text-[11px] sm:text-xs font-semibold text-cyber-cyan shadow-glow-cyan/5 mb-3 sm:mb-4">
          <Sparkles size={11} className="animate-spin" />
          <span>Multilingual Voice assistant v3.0</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-white/80 to-cyber-cyan bg-clip-text text-transparent tracking-tight leading-tight px-2">
          {statusText}
        </h1>
        <p className="text-xs sm:text-sm text-white/40 mt-2 font-medium max-w-sm sm:max-w-none">
          Say anything in Hindi, Marathi, Tamil, or English to begin.
        </p>
      </div>

      {/* Orb + Controls */}
      <div className="w-full flex flex-col items-center justify-center relative px-4">
        {/* Orb — smaller on mobile */}
        <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 relative">
          <VoiceOrb state={orbState} isListening={isRecording} audioAnalyser={audioAnalyser} />
        </div>

        {/* Live transcript pill */}
        {isRecording && liveTranscript && (
          <div className="mt-3 max-w-xs sm:max-w-lg w-full bg-cyber-card border border-white/5 backdrop-blur-md px-4 py-2.5 rounded-2xl text-center shadow-glow-cyan/5 text-sm text-cyber-cyan/95 font-medium animate-pulse">
            "{liveTranscript}"
          </div>
        )}

        {/* Thinking indicator */}
        {isAiThinking && (
          <div className="mt-3 flex items-center gap-2 bg-cyber-card border border-cyber-purple/20 px-5 py-2.5 rounded-2xl text-sm text-cyber-neonPurple font-bold shadow-glow-purple/10">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neonPurple opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-neonPurple" />
            </span>
            <span>Synthesizing Response...</span>
          </div>
        )}
      </div>

      {/* Mic + Stop button */}
      <div className="flex items-center justify-center gap-4 mt-4 sm:mt-6">
        {orbState === 'speaking' && (
          <button
            onClick={handleSilenceClick}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
            title="Stop speaking"
            aria-label="Stop speaking"
          >
            <VolumeX size={18} />
          </button>
        )}
        <button
          onClick={handleMicClick}
          className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative group
            ${isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
              : 'btn-glow text-white shadow-glow-neon'}
          `}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording
            ? <MicOff size={24} className="animate-pulse" />
            : <Mic size={24} className="group-hover:scale-110 transition-transform sm:w-7 sm:h-7" />}
        </button>
      </div>

      {/* Text Input */}
      <div className="w-full max-w-lg px-4 sm:px-6 mt-5 sm:mt-6 z-10">
        <form
          onSubmit={(e) => { e.preventDefault(); processPrompt(textInput); }}
          className="w-full relative flex items-center glass-panel border border-white/5 p-1.5 rounded-2xl shadow-glass focus-within:border-cyber-cyan/30 transition-all"
        >
          <input
            id="home-message-input"
            name="message"
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white/90 focus:outline-none placeholder-white/35 font-medium min-w-0"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="p-2.5 sm:p-3 bg-cyber-purple hover:bg-cyber-purple/80 disabled:opacity-40 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer flex-shrink-0"
            title="Send message"
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Suggestion Cards */}
      {messages.length === 0 && (
        <div className="w-full flex flex-col items-center pt-6 sm:pt-8 border-t border-white/5 mt-5 sm:mt-8">
          <span className="text-xs uppercase font-extrabold tracking-widest text-white/30 mb-2 px-4">Popular suggestions</span>
          <SuggestionCards onSelect={processPrompt} currentLang={currentLang} />
        </div>
      )}

      {/* Bottom spacer for scroll */}
      <div className="h-4 sm:h-8 flex-shrink-0" />
    </div>
  );
};

export default Home;
