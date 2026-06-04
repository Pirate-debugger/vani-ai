import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, Volume2, VolumeX, MessageCircle } from 'lucide-react';
import VoiceOrb from '../components/VoiceOrb';

const Assistant = ({ 
  currentLang, 
  voiceSpeed,
  voiceRecorder, 
  onSubmitPrompt,
  onEndSession // New prop: navigate away instead of reloading
}) => {
  const [sessionStatus, setSessionStatus] = useState('Voice Session Active');
  const [orbState, setOrbState] = useState('idle'); // idle, listening, thinking, speaking
  const [captions, setCaptions] = useState('Tap the microphone to start a conversation.');
  const [muted, setMuted] = useState(false);

  // ─── Fix: use a ref so the audioBlob effect always reads latest orbState ─────
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

  // ─── React to recording state changes ────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      setOrbStateSafe('listening');
      setSessionStatus('Listening...');
      setCaptions('Go ahead, I am listening to your voice...');
      cancelSpeech();
    } else {
      // Only transition to thinking if we were previously listening
      if (orbStateRef.current === 'listening') {
        setOrbStateSafe('thinking');
        setSessionStatus('Thinking...');
        setCaptions('Processing your request...');
      }
    }
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Submit audio / transcript when recording finishes ───────────────────────
  useEffect(() => {
    const handleVoiceSubmit = async () => {
      if (!audioBlob) return;

      // transcript is set by useVoiceRecorder after STT resolves (browser or backend)
      const spokenText = transcript.trim() || liveTranscript.trim();

      if (!spokenText) {
        setOrbStateSafe('idle');
        setSessionStatus('Voice Session Active');
        setCaptions("I couldn't catch that. Tap the mic to try again.");
        return;
      }

      setOrbStateSafe('thinking');
      setSessionStatus('Generating Response...');
      setCaptions(`"${spokenText}"`);

      try {
        const response = await onSubmitPrompt(spokenText);

        setOrbStateSafe('speaking');
        setSessionStatus('Speaking...');
        setCaptions(response.response);

        // Prefer real Sarvam TTS audio, fall back to browser synthesis
        if (response.audio_content) {
          const audio = new Audio(`data:audio/wav;base64,${response.audio_content}`);
          audio.play();
          audio.onended = () => {
            setOrbStateSafe('idle');
            setSessionStatus('Voice Session Active');
          };
        } else {
          speakWithTTS(response.response, currentLang, voiceSpeed, () => {
            setOrbStateSafe('idle');
            setSessionStatus('Voice Session Active');
          });
        }
      } catch (err) {
        console.error(err);
        setOrbStateSafe('idle');
        setSessionStatus('Voice Session Active');
        setCaptions("Something went wrong. Let's try again.");
      }
    };

    handleVoiceSubmit();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up synthesis on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMic = () => {
    if (muted) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleToggleMute = () => {
    if (isRecording) stopRecording();
    cancelSpeech();
    const nextMuted = !muted;
    setMuted(nextMuted);
    setOrbStateSafe('idle');
    setSessionStatus(nextMuted ? 'Assistant Muted' : 'Voice Session Active');
    setCaptions(nextMuted ? 'Sound feed muted.' : 'Tap mic to start conversing.');
  };

  // ─── Fix: replace window.location.reload() with clean state reset ────────────
  const handleEndSession = () => {
    if (isRecording) stopRecording();
    cancelSpeech();
    setOrbStateSafe('idle');
    setSessionStatus('Voice Session Active');
    setCaptions('Tap the microphone to start a conversation.');
    setMuted(false);
    // Navigate back to home if callback provided, otherwise just reset state
    if (typeof onEndSession === 'function') {
      onEndSession();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#040209] justify-between p-6 relative overflow-hidden">
      
      {/* Dynamic Background Grid overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(138,43,226,0.12)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Session Header Status */}
      <div className="w-full flex items-center justify-between px-4 mt-2 z-10 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
          </span>
          <span className="text-xs uppercase font-extrabold tracking-widest text-white/50">{sessionStatus}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-cyber-cyan shadow-glow-cyan/5">
          <Sparkles size={11} className="animate-pulse" />
          <span>Vani Live Mode</span>
        </div>
      </div>

      {/* Massive Immersive Morphing Orb */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[350px] z-10">
        <div className="w-80 h-80 md:w-96 md:h-96 relative">
          <VoiceOrb 
            state={orbState} 
            isListening={isRecording} 
            audioAnalyser={audioAnalyser} 
          />
        </div>
      </div>

      {/* Live Captions and Spoken Text Banner */}
      <div className="w-full max-w-3xl mx-auto px-4 z-10 min-h-[100px] flex items-center justify-center">
        <div className="glass-panel border-white/5 backdrop-blur-xl px-8 py-5 rounded-2xl w-full text-center shadow-glass relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-cyber-purple border border-cyber-purple/20 text-[9px] uppercase font-bold tracking-widest text-white/80">
            {orbState === 'listening' ? 'Capturing' : orbState === 'speaking' ? 'Assistant Spoke' : 'Dialogue'}
          </div>
          <p className={`text-sm md:text-base font-semibold leading-relaxed transition-all duration-300 ${orbState === 'listening' ? 'text-cyber-cyan/90 animate-pulse' : 'text-white/80'}`}>
            {captions}
          </p>
          {/* Live transcript overlay while recording */}
          {isRecording && voiceRecorder.liveTranscript && (
            <p className="text-xs text-cyber-cyan/60 mt-2 italic">"{voiceRecorder.liveTranscript}"</p>
          )}
        </div>
      </div>

      {/* Touch-Friendly Voice Call Controls */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-around py-8 px-4 z-10">
        
        {/* Mute Control */}
        <button
          onClick={handleToggleMute}
          className={`
            w-14 h-14 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-105
            ${muted 
              ? 'bg-red-500/25 border-red-500/30 text-red-400 hover:bg-red-500/35' 
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}
          `}
          title={muted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* Dynamic Mic Clicker */}
        <button
          onClick={handleToggleMic}
          disabled={muted}
          className={`
            w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative group cursor-pointer hover:scale-105 disabled:opacity-30 disabled:scale-100
            ${isRecording 
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
              : 'btn-glow text-white shadow-glow-neon'}
          `}
        >
          {isRecording ? (
            <MicOff size={32} className="animate-pulse" />
          ) : (
            <Mic size={32} className="group-hover:scale-110 transition-transform" />
          )}
        </button>

        {/* End Voice Session — no more page reload */}
        <button
          onClick={handleEndSession}
          className="w-14 h-14 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          title="End Voice Session"
        >
          <PhoneOff size={20} />
        </button>
      </div>

    </div>
  );
};

export default Assistant;
