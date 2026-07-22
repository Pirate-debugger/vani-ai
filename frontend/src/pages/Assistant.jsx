import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, Volume2, VolumeX, Radio, ArrowLeftRight, Briefcase } from 'lucide-react';
import VoiceOrb from '../components/VoiceOrb';
import TaskBoard from '../components/TaskBoard';


const LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'en-IN', label: 'English' },
  { code: 'as-IN', label: 'অসমীয়া' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'brx-IN', label: 'बड़ो' },
  { code: 'doi-IN', label: 'डोगरी' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ks-IN', label: 'कॉशुर' },
  { code: 'kok-IN', label: 'कोंकणी' },
  { code: 'mai-IN', label: 'मैथिली' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'mni-IN', label: 'ꯃꯤꯇꯩꯂꯣꯟ' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'ne-IN', label: 'नेपाली' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
  { code: 'sa-IN', label: 'संस्कृत' },
  { code: 'sat-IN', label: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd-IN', label: 'सिन्धी' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'ur-IN', label: 'اردو' },
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
  setCurrentLang,
  voiceSpeed,
  voiceRecorder, 
  onSubmitPrompt,
  onEndSession,
  accessibilityMode 
}) => {
  const [sessionStatus, setSessionStatus] = useState('✅ Ready');
  const [orbState, setOrbState]           = useState('idle');
  const [captions, setCaptions]           = useState('Tap the microphone to start a conversation.');
  const [muted, setMuted]                 = useState(false);
  const [bridgeMode, setBridgeMode]       = useState(
    () => localStorage.getItem('vani_bridge_mode') === 'true'
  );
  const [bridgeLangOpen, setBridgeLangOpen] = useState(false);
  const [paneALangOpen, setPaneALangOpen]   = useState(false);
  const [paneBLangOpen, setPaneBLangOpen]   = useState(false);
  const [vadMode, setVadMode]             = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [secondaryLang, setSecondaryLang] = useState(
    () => localStorage.getItem('vani_secondary_lang') || 'en-IN'
  );
  const [agentMode, setAgentMode] = useState('chat'); // 'chat' | 'work_agent'
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [projectId, setProjectId] = useState(
    () => localStorage.getItem('current_project_id') || null
  );

  const closeAllDropdowns = () => {
    setBridgeLangOpen(false);
    setPaneALangOpen(false);
    setPaneBLangOpen(false);
  };

  const orbStateRef = useRef('idle');
  const vadRef      = useRef(null);
  const abortControllerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close all dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    startSpeechRecognition,
    stopSpeechRecognition,
    sendVoiceCommand,
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
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
            }
            startSpeechRecognition?.();
            setOrbStateSafe('listening');
            setSessionStatus('🎤 Listening');
            setCaptions('Go ahead, I am listening...');
          },
          onSpeechEnd: async (audio) => {
            if (muted) return;
            stopSpeechRecognition?.();
            setOrbStateSafe('thinking');
            setSessionStatus('🧠 Translating');
            const wavBlob = float32ToWav(audio);
            await setExternalAudioBlob?.(wavBlob);
          },
          positiveSpeechThreshold: 0.8,
          negativeSpeechThreshold: 0.35,
          minSpeechFrames: 3,
          redemptionFrames: 100, // ~3 seconds silence timeout
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
      setSessionStatus('✅ Ready');
    }
  }, [vadMode, muted, cancelSpeech, clearTTSQueue, setExternalAudioBlob]);

  useEffect(() => {
    if (isRecording) {
      setOrbStateSafe('listening');
      setSessionStatus('🎤 Listening');
      setCaptions('Go ahead, I am listening to your voice...');
      cancelSpeech();
    } else {
      if (orbStateRef.current === 'listening') {
        setOrbStateSafe('thinking');
        setSessionStatus('🧠 Translating');
        setCaptions('Processing your request...');
      }
    }
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Streaming voice submit (PART 1 of mega-prompt) ─────────────────────────
  useEffect(() => {
    if (!audioBlob) return;

    const handleVoiceSubmit = async () => {
      try {
        // Interpreter / Bridge mode bypasses local STT and LLM completely
        if (bridgeMode) {
          await handleBridgeSubmit();
          return;
        }

        const text = await voiceRecorder.waitForTranscript();
        if (!text) {
          setOrbStateSafe('idle');
          setSessionStatus('✅ Ready');
          setCaptions("I couldn't catch that. Tap the mic to try again.");
          clearTTSQueue?.();
          return;
        }

        if (agentMode === 'work_agent') {
          // --- WORK AGENT MODE ---
          setOrbStateSafe('thinking');
          setSessionStatus('🧠 Work Agent Processing');
          setCaptions(`"${text}"`);

          const cmdResult = await sendVoiceCommand(audioBlob, {
            projectId: projectId || localStorage.getItem('current_project_id') || null,
            languageCode: currentLang
          });

          setOrbStateSafe('speaking');
          setSessionStatus('🔊 Speaking');
          setCaptions(cmdResult.reply || 'Command processed.');

          if (cmdResult.tasks && cmdResult.tasks.length > 0) {
            setExtractedTasks(cmdResult.tasks);
          }

          setConversationHistory(prev => [
            ...prev,
            { role: 'user', content: text },
            { role: 'assistant', content: cmdResult.reply }
          ]);

          setOrbStateSafe('idle');
          setSessionStatus('✅ Ready');
          return;
        }

        // --- CHAT MODE (Existing behavior) ---
        setOrbStateSafe('thinking');
        setSessionStatus('🧠 Translating');
        setCaptions(`"${text}"`);

        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: text }
        ];
        setConversationHistory(updatedHistory);

        let streamedText = '';
        setOrbStateSafe('speaking');
        setSessionStatus('🔊 Speaking');

        abortControllerRef.current = new AbortController();

        await streamAndSpeak({
          messages: updatedHistory,
          langCode: currentLang,
          speed: voiceSpeed,
          signal: abortControllerRef.current.signal,
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
            setSessionStatus('✅ Ready');
          }
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('AI response was interrupted by user.');
          return;
        }
        console.error(err);
        setOrbStateSafe('idle');
        setSessionStatus('✅ Ready');
        setCaptions(getErrorMessage(err));
        clearTTSQueue?.();
      } finally {
        if (orbStateRef.current === 'thinking') {
          setOrbStateSafe('idle');
          setSessionStatus('✅ Ready');
        }
        resetAudioBlob?.();
      }
    };

    handleVoiceSubmit();
  }, [audioBlob, agentMode, projectId, currentLang]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleBridgeSubmit = async () => {
    if (!audioBlob) return;
    setOrbStateSafe('thinking');
    setSessionStatus(`🧠 Translating...`);
    setCaptions('Listening and detecting language...');

    try {
      const reader = new FileReader();
      const audioBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${API_BASE}/voice/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          lang1: currentLang,
          lang2: secondaryLang,
          mimeType: audioMimeType || 'audio/webm'
        })
      });


      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Interpreter failed (${res.status})`);
      }

      const data = await res.json();
      
      // Handle empty transcript (no speech detected)
      if (!data.transcript || !data.transcript.trim()) {
        setOrbStateSafe('idle');
        setSessionStatus('✅ Ready');
        setCaptions("I couldn't hear you clearly. Try speaking louder or closer to the mic.");
        return;
      }

      setOrbStateSafe('speaking');
      setSessionStatus(`🔊 Speaking (${data.targetLang})`);
      
      const translationDisplay = `[${data.sourceLang}] ${data.transcript}\n↓\n[${data.targetLang}] ${data.translatedText}`;
      setCaptions(translationDisplay);

      setConversationHistory(prev => [
        ...prev,
        {
          type: 'bridge',
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          transcript: data.transcript,
          translation: data.translatedText
        }
      ]);

      if (data.audioContent) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioContent}`);
        audio.play();
        audio.onended = () => { setOrbStateSafe('idle'); setSessionStatus('✅ Ready'); };
      } else {
        speakWithTTS(data.translatedText, data.targetLang, voiceSpeed, () => {
          setOrbStateSafe('idle');
          setSessionStatus('✅ Ready');
        });
      }
    } catch (err) {
      console.error('Interpreter mode error:', err);
      setOrbStateSafe('idle');
      setSessionStatus('✅ Ready');
      setCaptions(getErrorMessage(err));
    } finally {
      if (orbStateRef.current === 'thinking') {
        setOrbStateSafe('idle');
        setSessionStatus('✅ Ready');
      }
      resetAudioBlob?.();
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
    setSessionStatus(nextMuted ? 'Assistant Muted' : '✅ Ready');
    setCaptions(nextMuted ? 'Sound feed muted.' : 'Tap mic to start conversing.');
  };

  const handleEndSession = () => {
    if (isRecording) stopRecording();
    cancelSpeech();
    clearTTSQueue?.();
    vadRef.current?.destroy?.();
    setOrbStateSafe('idle');
    setSessionStatus('✅ Ready');
    setCaptions('Tap the microphone to start a conversation.');
    setMuted(false);
    setVadMode(false);
    if (typeof onEndSession === 'function') onEndSession();
  };

  return (
    <div ref={dropdownRef} className="flex-1 flex flex-col h-full bg-transparent dark:bg-[#040209] justify-between px-4 sm:p-6 pt-4 sm:pt-6 pb-4 sm:pb-6 relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(138,43,226,0.12)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Session Header */}
      <div className="w-full flex items-center justify-between px-2 sm:px-4 mt-1 sm:mt-2 z-10 max-w-4xl mx-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${orbState === 'listening' ? 'bg-red-500' : 'bg-cyber-cyan'}`} />
          </span>
          <span className={`${accessibilityMode ? 'text-sm sm:text-base' : 'text-[10px] sm:text-xs'} uppercase font-extrabold tracking-widest text-white/50 truncate max-w-[120px] sm:max-w-none`}>{sessionStatus}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Agent Mode Toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5 text-[9px] sm:text-[10px] font-bold">
            <button
              onClick={() => setAgentMode('chat')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                agentMode === 'chat'
                  ? 'bg-cyber-purple text-white shadow-glow-neon'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setAgentMode('work_agent')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                agentMode === 'work_agent'
                  ? 'bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Briefcase size={10} />
              Work Agent
            </button>
          </div>

          {/* Bridge Mode toggle */}

          <button
            onClick={() => {
              const next = !bridgeMode;
              setBridgeMode(next);
              localStorage.setItem('vani_bridge_mode', String(next));
              closeAllDropdowns();
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${accessibilityMode ? 'text-xs sm:text-sm px-4 py-2' : 'text-[9px] sm:text-[10px]'} font-bold border transition-all cursor-pointer ${
              bridgeMode
                ? 'bg-cyber-cyan/15 border-cyber-cyan/30 text-cyber-cyan'
                : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
            }`}
            title="Bridge Mode: speak in one language, AI responds in another"
            aria-label={bridgeMode ? 'Disable Bridge Mode' : 'Enable Bridge Mode'}
          >
            <ArrowLeftRight size={accessibilityMode ? 14 : 10} />
            <span className="hidden sm:inline">Bridge</span> {bridgeMode ? 'ON' : 'OFF'}
          </button>

          {bridgeMode && (
            <div className="relative">
              <button
                onClick={() => setBridgeLangOpen(o => !o)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/5 border border-cyber-cyan/20 text-[9px] sm:text-[10px] text-cyber-cyan font-bold transition-all hover:bg-white/10"
                aria-label="Select Bridge Mode target language"
              >
                <span className="truncate max-w-[80px] sm:max-w-[120px]">
                  {LANGUAGES.find(l => l.code === secondaryLang)?.label || secondaryLang}
                </span>
                <span className={`transition-transform flex-shrink-0 ${bridgeLangOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {bridgeLangOpen && (
                <div className="absolute top-full right-0 mt-1 glass-panel !bg-[#110e20] border border-white/10 rounded-xl overflow-y-auto overscroll-contain max-h-64 shadow-xl z-[100] w-40" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                  {LANGUAGES.filter(l => l.code !== currentLang).map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setSecondaryLang(l.code);
                        localStorage.setItem('vani_secondary_lang', l.code);
                        setBridgeLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/10 ${
                        secondaryLang === l.code ? 'text-cyber-cyan font-bold bg-cyber-cyan/10' : 'text-white/70'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-cyber-cyan">
            <Sparkles size={11} className="animate-pulse" />
            <span>Vani Live Mode</span>
          </div>
        </div>
      </div>

      {/* Orb — responsive sizing */}
      <div className="w-full flex-1 flex flex-col justify-center" style={{ maxHeight: 'calc(100dvh - 128px)' }}>
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

      {/* Dynamic Content Area: Normal Captions vs Dual Screen */}
      <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 z-10 flex-1 flex flex-col justify-end pb-4 sm:pb-8">
        {bridgeMode ? (
          <div className="flex flex-col md:flex-row gap-3 sm:gap-6 w-full h-full min-h-[140px] max-h-[35vh] md:max-h-[220px]">
            {/* Speaker A (Left/Top) */}
            <div className={`flex-1 glass-panel border-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-visible transition-all duration-500 ${orbState === 'listening' && (!conversationHistory.length || conversationHistory[conversationHistory.length - 1]?.sourceLang !== currentLang) ? 'border-green-500/30 bg-green-500/5' : ''}`}>
              <div className="absolute top-0 w-full bg-black/20 border-b border-white/5 z-20">
                <button
                  onClick={() => { setPaneALangOpen(o => !o); setPaneBLangOpen(false); }}
                  className="w-full py-1.5 sm:py-2 text-center text-[10px] sm:text-xs uppercase font-extrabold text-white/70 tracking-widest hover:text-white transition-colors cursor-pointer"
                >
                  {LANGUAGES.find(l => l.code === currentLang)?.label || currentLang} ▼
                </button>
                {paneALangOpen && (
                  <div className="absolute top-full left-0 right-0 glass-panel !bg-[#110e20] border-b border-white/10 overflow-y-auto overscroll-contain max-h-48 z-[100]" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                    {LANGUAGES.map(l => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setCurrentLang(l.code);
                          setPaneALangOpen(false);
                        }}
                        className={`w-full text-center px-3 py-2 text-xs transition-colors hover:bg-white/10 ${
                          currentLang === l.code ? 'text-cyber-cyan font-bold bg-cyber-cyan/10' : 'text-white/70'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 sm:mt-8 text-center w-full overflow-y-auto scrollbar-none flex flex-col justify-center items-center h-full">
                {conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1]?.type === 'bridge' ? (
                  conversationHistory[conversationHistory.length - 1].sourceLang === currentLang ? (
                    <>
                      <p className={`text-white/50 ${accessibilityMode ? 'text-sm mb-2' : 'text-[10px] sm:text-xs mb-1.5'} font-medium uppercase tracking-wider`}>Original Speech</p>
                      <p className={`text-white/90 ${accessibilityMode ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'} font-medium`}>{conversationHistory[conversationHistory.length - 1].transcript}</p>
                    </>
                  ) : conversationHistory[conversationHistory.length - 1].targetLang === currentLang ? (
                    <>
                      <p className={`text-green-400/70 ${accessibilityMode ? 'text-sm mb-2' : 'text-[10px] sm:text-xs mb-1.5'} font-bold uppercase tracking-wider animate-pulse`}>Translated Output</p>
                      <p className={`text-green-400 ${accessibilityMode ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'} font-bold`}>{conversationHistory[conversationHistory.length - 1].translation}</p>
                    </>
                  ) : null
                ) : (
                  <p className="text-white/30 text-xs sm:text-sm italic">Awaiting speech...</p>
                )}
                
                {/* Live Transcript overlay for Speaker A */}
                {(isRecording || vadMode) && liveTranscript && orbState === 'listening' && (
                  <p className="text-sm md:text-base font-semibold leading-relaxed text-green-400/90 mt-3 absolute bottom-4 animate-pulse">
                    {liveTranscript}
                  </p>
                )}
              </div>
            </div>

            {/* Speaker B (Right/Bottom) */}
            <div className={`flex-1 glass-panel border-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-visible transition-all duration-500 ${orbState === 'listening' && (!conversationHistory.length || conversationHistory[conversationHistory.length - 1]?.sourceLang !== secondaryLang) ? 'border-blue-500/30 bg-blue-500/5' : ''}`}>
              <div className="absolute top-0 w-full bg-black/20 border-b border-white/5 z-20">
                <button
                  onClick={() => { setPaneBLangOpen(o => !o); setPaneALangOpen(false); }}
                  className="w-full py-1.5 sm:py-2 text-center text-[10px] sm:text-xs uppercase font-extrabold text-white/70 tracking-widest hover:text-white transition-colors cursor-pointer"
                >
                  {LANGUAGES.find(l => l.code === secondaryLang)?.label || secondaryLang} ▼
                </button>
                {paneBLangOpen && (
                  <div className="absolute top-full left-0 right-0 glass-panel !bg-[#110e20] border-b border-white/10 overflow-y-auto overscroll-contain max-h-48 z-[100]" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                    {LANGUAGES.filter(l => l.code !== currentLang).map(l => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setSecondaryLang(l.code);
                          localStorage.setItem('vani_secondary_lang', l.code);
                          setPaneBLangOpen(false);
                        }}
                        className={`w-full text-center px-3 py-2 text-xs transition-colors hover:bg-white/10 ${
                          secondaryLang === l.code ? 'text-cyber-cyan font-bold bg-cyber-cyan/10' : 'text-white/70'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 sm:mt-8 text-center w-full overflow-y-auto scrollbar-none flex flex-col justify-center items-center h-full">
                {conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1]?.type === 'bridge' ? (
                  conversationHistory[conversationHistory.length - 1].sourceLang === secondaryLang ? (
                    <>
                      <p className={`text-white/50 ${accessibilityMode ? 'text-sm mb-2' : 'text-[10px] sm:text-xs mb-1.5'} font-medium uppercase tracking-wider`}>Original Speech</p>
                      <p className={`text-white/90 ${accessibilityMode ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'} font-medium`}>{conversationHistory[conversationHistory.length - 1].transcript}</p>
                    </>
                  ) : conversationHistory[conversationHistory.length - 1].targetLang === secondaryLang ? (
                    <>
                      <p className={`text-blue-400/70 ${accessibilityMode ? 'text-sm mb-2' : 'text-[10px] sm:text-xs mb-1.5'} font-bold uppercase tracking-wider animate-pulse`}>Translated Output</p>
                      <p className={`text-blue-400 ${accessibilityMode ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'} font-bold`}>{conversationHistory[conversationHistory.length - 1].translation}</p>
                    </>
                  ) : null
                ) : (
                  <p className="text-white/30 text-xs sm:text-sm italic">Awaiting speech...</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel border-white/5 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-5 rounded-2xl w-full max-w-3xl mx-auto text-center shadow-glass relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 sm:px-3 py-0.5 rounded-full bg-cyber-purple border border-cyber-purple/20 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-white/80 whitespace-nowrap">
              {orbState === 'listening' ? 'Capturing' : orbState === 'speaking' ? 'Assistant Speaking' : 'Dialogue'}
            </div>
            {(isRecording || vadMode) && liveTranscript ? (
              <p className={`font-semibold leading-relaxed ${accessibilityMode ? 'text-xl sm:text-3xl' : 'text-sm md:text-base'} text-cyber-cyan/90`}>
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
        )}

        {/* Task Board Component for Work Agent Mode */}
        {(agentMode === 'work_agent' || extractedTasks.length > 0) && (
          <div className="w-full max-w-3xl mx-auto">
            <TaskBoard tasks={extractedTasks} projectId={projectId} />
          </div>
        )}
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
          aria-label={muted ? 'Unmute' : 'Mute'}
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
          aria-label={vadMode ? 'Hands-free VAD active' : isRecording ? 'Stop recording' : 'Start recording'}
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
          aria-label={vadMode ? 'Disable hands-free mode' : 'Enable hands-free (auto-detect speech)'}
        >
          {vadMode ? '🎙️' : <span className="text-[10px] font-black">VAD</span>}
        </button>

        {/* End session */}
        <button
          onClick={handleEndSession}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          title="End Voice Session"
          aria-label="End Voice Session"
        >
          <PhoneOff size={17} />
        </button>
      </div>
    </div>
  );
};

export default Assistant;
