import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, Volume2, VolumeX, Radio, ArrowLeftRight } from 'lucide-react';
import VoiceOrb from '../components/VoiceOrb';

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'en-IN', label: 'English' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
];

// ─── float32ToWav helper for VAD ─────────────────────────────────────────────
function float32ToWav(float32Array, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + float32Array.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + float32Array.length * 2, true);
  writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); writeStr(36, 'data');
  view.setUint32(40, float32Array.length * 2, true);
  const pcm = new Int16Array(buffer, 44);
  for (let i = 0; i < float32Array.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const Assistant = ({ 
  currentLang, 
  voiceSpeed,
  voiceRecorder, 
  onSubmitPrompt,
  onEndSession
}) => {
  const [sessionStatus, setSessionStatus] = useState('Voice Session Active');
  const [orbState, setOrbState]           = useState('idle');
  const [captions, setCaptions]           = useState('Tap the microphone to start a conversation.');
  const [muted, setMuted]                 = useState(false);
  const [bridgeMode, setBridgeMode]       = useState(false);
  const [vadMode, setVadMode]             = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [secondaryLang, setSecondaryLang] = useState(
    () => localStorage.getItem('vani_secondary_lang') || 'en-IN'
  );

  const orbStateRef = useRef('idle');
  const vadRef      = useRef(null);

  const setOrbStateSafe = (s) => {
    orbStateRef.current = s;
    setOrbState(s);
  };

  const getErrorMessage = (error) => {
    if (!error.response && error.message === 'Network Error') {
      return "Connection lost. Check your internet and try again.";
    }
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message;
    
    if (status === 429) return "Too many requests. Please wait a moment before trying again.";
    if (status === 503) return "Sarvam AI service is temporarily unavailable. Try again in a few seconds.";
    if (status === 400 && msg?.toLowerCase().includes('audio')) return "No audio detected. Try speaking louder or closer to the mic.";
    return "Something went wrong. The backend may be offline.";
  };

  const {
    isRecording,
    transcript,
    liveTranscript,
    audioBlob,
    audioMimeType,
    audioAnalyser,
    startRecording,
    stopRecording,
    speakWithTTS,
    cancelSpeech,
    resetAudioBlob,
    streamAndSpeak,
    clearTTSQueue,
    setExternalAudioBlob,
  } = voiceRecorder;

  // ─── VAD mode: Hands-free Voice Activity Detection ───────────────────────────
  const handleToggleVAD = useCallback(async () => {
    const next = !vadMode;
    setVadMode(next);

    if (next) {
      try {
        // Dynamically import vad-react to avoid breaking builds if not installed
        const { MicVAD } = await import('@ricky0123/vad-web');
        const vad = await MicVAD.new({
          onSpeechStart: () => {
            if (muted) return;
            if (orbStateRef.current === 'speaking') {
              cancelSpeech();
              clearTTSQueue?.();
            }
            setOrbStateSafe('listening');
            setSessionStatus('Listening...');
            setCaptions('Go ahead, I am listening...');
          },
          onSpeechEnd: async (audio) => {
            if (muted) return;
            setOrbStateSafe('thinking');
            setSessionStatus('Processing...');
            const wavBlob = float32ToWav(audio);
            await setExternalAudioBlob?.(wavBlob);
          },
          positiveSpeechThreshold: 0.8,
          negativeSpeechThreshold: 0.35,
          minSpeechFrames: 3,
          redemptionFrames: 8,
        });
        vadRef.current = vad;
        vad.start();
        setSessionStatus('Hands-free mode ON — speak naturally');
      } catch (err) {
        console.warn('[VAD] Failed to load VAD:', err.message);
        setVadMode(false);
        setSessionStatus('VAD unavailable — tap mic to speak');
      }
    } else {
      vadRef.current?.destroy?.();
      vadRef.current = null;
      setSessionStatus('Voice Session Active');
    }
  }, [vadMode, muted, cancelSpeech, clearTTSQueue, setExternalAudioBlob]);

  useEffect(() => {
    if (isRecording) {
      setOrbStateSafe('listening');
      setSessionStatus('Listening...');
      setCaptions('Go ahead, I am listening to your voice...');
      cancelSpeech();
    } else {
      if (orbStateRef.current === 'listening') {
        setOrbStateSafe('thinking');
        setSessionStatus('Thinking...');
        setCaptions('Processing your request...');
      }
    }
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Streaming voice submit (PART 1 of mega-prompt) ─────────────────────────
  useEffect(() => {
    if (!audioBlob) return;

    const handleVoiceSubmit = async () => {
      try {
        const text = await voiceRecorder.waitForTranscript();
        if (!text) {
          setOrbStateSafe('idle');
          setSessionStatus('Voice Session Active');
          setCaptions("I couldn't catch that. Tap the mic to try again.");
          clearTTSQueue?.();
          return;
        }

        // Bridge mode uses existing pipeline
        if (bridgeMode) {
          await handleBridgeSubmit(text);
          return;
        }

        setOrbStateSafe('thinking');
        setSessionStatus('Generating Response...');
        setCaptions(`"${text}"`);

        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: text }
        ];
        setConversationHistory(updatedHistory);

        let streamedText = '';
        setOrbStateSafe('speaking');
        setSessionStatus('Speaking...');

        await streamAndSpeak({
          messages: updatedHistory,
          langCode: currentLang,
          speed: voiceSpeed,
          onToken: (token) => {
            streamedText += token;
            setCaptions(streamedText);
          },
          onDone: () => {
            setConversationHistory(prev => [
              ...prev,
              { role: 'assistant', content: streamedText }
            ]);
            setOrbStateSafe('idle');
            setSessionStatus('Voice Session Active');
          }
        });
      } catch (err) {
        console.error(err);
        setOrbStateSafe('idle');
        setSessionStatus('Voice Session Active');
        setCaptions(getErrorMessage(err));
        clearTTSQueue?.();
      } finally {
        if (orbStateRef.current === 'thinking') {
          setOrbStateSafe('idle');
          setSessionStatus('Voice Session Active');
        }
        resetAudioBlob?.();
      }
    };

    handleVoiceSubmit();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBridgeSubmit = async (spokenText) => {
    if (!audioBlob) return;
    setOrbStateSafe('thinking');
    setSessionStatus(`Translating ${currentLang} → ${secondaryLang}...`);
    setCaptions(`"${spokenText}"`);

    try {
      const reader = new FileReader();
      const audioBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const res = await fetch('/api/voice/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          sourceLang: currentLang,
          targetLang: secondaryLang,
          mimeType: audioMimeType || 'audio/webm'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Bridge mode failed');
      }

      const data = await res.json();
      setOrbStateSafe('speaking');
      setSessionStatus('Bridge Response...');
      setCaptions(`[${secondaryLang}] ${data.llmReply}`);

      if (data.audioContent) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioContent}`);
        audio.play();
        audio.onended = () => { setOrbStateSafe('idle'); setSessionStatus('Bridge Mode Active'); };
      } else {
        speakWithTTS(data.llmReply, secondaryLang, voiceSpeed, () => {
          setOrbStateSafe('idle');
          setSessionStatus('Bridge Mode Active');
        });
      }
    } catch (err) {
      console.error('Bridge mode error:', err);
      setOrbStateSafe('idle');
      setSessionStatus('Voice Session Active');
      setCaptions('Bridge Mode requires a Sarvam API key. Check Settings.');
    } finally {
      if (orbStateRef.current === 'thinking') {
        setOrbStateSafe('idle');
        setSessionStatus('Voice Session Active');
      }
    }
  };

  useEffect(() => {
    return () => { cancelSpeech(); vadRef.current?.destroy?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMic = () => {
    if (muted) return;
    if (isRecording) stopRecording();
    else startRecording();
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

  const handleEndSession = () => {
    if (isRecording) stopRecording();
    cancelSpeech();
    clearTTSQueue?.();
    vadRef.current?.destroy?.();
    setOrbStateSafe('idle');
    setSessionStatus('Voice Session Active');
    setCaptions('Tap the microphone to start a conversation.');
    setMuted(false);
    setVadMode(false);
    if (typeof onEndSession === 'function') onEndSession();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent dark:bg-[#040209] justify-between px-4 sm:p-6 pt-4 sm:pt-6 pb-4 sm:pb-6 relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(138,43,226,0.12)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Session Header */}
      <div className="w-full flex items-center justify-between px-2 sm:px-4 mt-1 sm:mt-2 z-10 max-w-4xl mx-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
          </span>
          <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-widest text-white/50 truncate max-w-[120px] sm:max-w-none">{sessionStatus}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Bridge Mode toggle */}
          <button
            onClick={() => setBridgeMode(b => !b)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold border transition-all cursor-pointer ${
              bridgeMode
                ? 'bg-cyber-cyan/15 border-cyber-cyan/30 text-cyber-cyan'
                : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
            }`}
            title="Bridge Mode: speak in one language, AI responds in another"
          >
            <ArrowLeftRight size={10} />
            <span className="hidden sm:inline">Bridge</span> {bridgeMode ? 'ON' : 'OFF'}
          </button>

          {bridgeMode && (
            <select
              value={secondaryLang}
              onChange={(e) => {
                setSecondaryLang(e.target.value);
                localStorage.setItem('vani_secondary_lang', e.target.value);
              }}
              className="bg-white/5 border border-cyber-cyan/20 rounded-lg px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] text-cyber-cyan font-bold focus:outline-none"
            >
              {LANGUAGES.filter(l => l.code !== currentLang).map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-cyber-cyan">
            <Sparkles size={11} className="animate-pulse" />
            <span>Vani Live Mode</span>
          </div>
        </div>
      </div>

      {/* Orb — responsive sizing */}
      <div className="w-full flex-1 flex flex-col justify-center" style={{ maxHeight: 'calc(100vh - 128px)' }}>
        <div className="flex flex-col items-center justify-center relative z-10 w-full" style={{ height: 'clamp(200px, 40vh, 420px)' }}>
          <div className="w-48 h-48 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 relative flex items-center justify-center">
            <VoiceOrb state={orbState} isListening={isRecording} audioAnalyser={audioAnalyser} />
          </div>
          {bridgeMode && (
            <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 text-[10px] sm:text-xs font-bold text-cyber-cyan">
              <Radio size={11} className="animate-pulse" />
              <span>{LANGUAGES.find(l => l.code === currentLang)?.label || currentLang}</span>
              <ArrowLeftRight size={11} />
              <span>{LANGUAGES.find(l => l.code === secondaryLang)?.label || secondaryLang}</span>
            </div>
          )}
        </div>
      </div>

      {/* Captions */}
      <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 z-10 min-h-[80px] sm:min-h-[100px] flex items-center justify-center">
        <div className="glass-panel border-white/5 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-5 rounded-2xl w-full text-center shadow-glass relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 sm:px-3 py-0.5 rounded-full bg-cyber-purple border border-cyber-purple/20 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-white/80 whitespace-nowrap">
            {orbState === 'listening' ? 'Capturing' : orbState === 'speaking' ? 'Assistant Speaking' : 'Dialogue'}
          </div>
          {isRecording && liveTranscript ? (
            <p className="text-sm md:text-base font-semibold leading-relaxed text-cyber-cyan/90">
              {liveTranscript.split(' ').map((word, i) => (
                <span key={i} className="word-fade" style={{ animationDelay: `${i * 0.04}s` }}>
                  {word}{' '}
                </span>
              ))}
            </p>
          ) : (
            <p className={`text-sm md:text-base font-semibold leading-relaxed transition-all duration-300
              ${orbState === 'speaking' ? 'streaming-text' : ''}
              ${orbState === 'listening' ? 'text-cyber-cyan/90 animate-pulse' : 'text-white/80'}`}>
              {captions}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-around py-4 sm:py-8 px-4 z-10">
        {/* Mute */}
        <button
          onClick={handleToggleMute}
          className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-105 ${
            muted ? 'bg-red-500/25 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        {/* Main mic button */}
        <button
          onClick={handleToggleMic}
          disabled={muted || vadMode}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 relative group cursor-pointer hover:scale-105 disabled:opacity-30 disabled:scale-100 ${
            isRecording ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'btn-glow text-white shadow-glow-neon'
          }`}
          title={vadMode ? 'Hands-free VAD active' : isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <MicOff size={28} className="animate-pulse" /> : <Mic size={28} className="group-hover:scale-110 transition-transform" />}
        </button>

        {/* VAD hands-free toggle */}
        <button
          onClick={handleToggleVAD}
          className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-105 text-xs font-bold ${
            vadMode
              ? 'bg-cyber-cyan/20 border-cyber-cyan/40 text-cyber-cyan shadow-glow-cyan/20'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
          }`}
          title={vadMode ? 'Disable hands-free mode' : 'Enable hands-free (auto-detect speech)'}
        >
          {vadMode ? '🎙️' : <span className="text-[10px] font-black">VAD</span>}
        </button>

        {/* End session */}
        <button
          onClick={handleEndSession}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          title="End Voice Session"
        >
          <PhoneOff size={17} />
        </button>
      </div>
    </div>
  );
};

export default Assistant;
