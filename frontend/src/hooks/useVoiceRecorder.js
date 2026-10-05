import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const MAX_RECORDING_MS = 30000; // Configurable safety limit: 30 seconds for long input
const SILENCE_TIMEOUT_MS = 1600; // ~1.6s silence triggers auto-stop
const SPEECH_THRESHOLD = 15; // Audio energy threshold for VAD

export const useVoiceRecorder = (languageCode = 'hi-IN') => {
  const [isRecording, setIsRecording]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioBlob, setAudioBlob]       = useState(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [isSttLoading, setIsSttLoading] = useState(false);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  
  // Voice State Machine & Session
  const [voiceState, setVoiceState]     = useState('idle'); // 'idle' | 'pressing' | 'listening' | 'finalizing' | 'transcribing' | 'routing' | 'thinking' | 'researching' | 'executing' | 'speaking' | 'error'
  const [talkMode, setTalkMode]         = useState('tap'); // 'tap' | 'hold' | 'hands_free'
  const [voiceSession, setVoiceSession] = useState(null);

  const voiceSessionRef  = useRef(null);
  const maxTimerRef      = useRef(null);
  const silenceTimerRef  = useRef(null);
  const vadIntervalRef   = useRef(null);
  const hasSpokenRef     = useRef(false);

  // Safari-compatible MIME type detection
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  };

  // Web Audio elements for visualizer
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser]         = useState(null);

  // Cached voices list — populated via onvoiceschanged to avoid race condition
  const voicesRef = useRef([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recognitionRef   = useRef(null);
  const streamRef        = useRef(null);
  const transcriptRef    = useRef('');
  const currentAudioRef  = useRef(null); // Track currently playing audio element
  const audioContextRef  = useRef(null); // Ref to avoid stale closure in stopRecording

  // TTS sentence queue for streaming responses
  const ttsQueueRef   = useRef([]);
  const isPlayingRef  = useRef(false);

  const transcriptPromiseRef = useRef(null);

  // ─── Load voices properly via onvoiceschanged ─────────────────────────────────
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) voicesRef.current = v;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ─── Initialize Speech Recognition ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = languageCode;

      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          const updated = transcriptRef.current + ' ' + final;
          transcriptRef.current = updated;
          setTranscript(updated);
        }
        setLiveTranscript(interim);
      };

      rec.onerror = (err) => {
        if (err.error !== 'no-speech') console.error('Speech Recognition Error:', err.error);
      };

      recognitionRef.current = rec;
    }
  }, [languageCode]);

  const startSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        transcriptRef.current = '';
        setTranscript('');
        setLiveTranscript('');
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition already started or failed to start:', e);
      }
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, []);

  // ─── Backend STT fallback ─────────────────────────────────────────────────────
  const submitAudioToSTT = useCallback(async (blob, mimeType) => {
    if (!blob || blob.size < 1000) return null;
    try {
      setIsSttLoading(true);
      const formData = new FormData();
      const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
      formData.append('file', blob, `audio.${ext}`);
      formData.append('language_code', languageCode);
      const res = await fetch(`${API_BASE}/voice/stt`, { method: 'POST', credentials: 'include', body: formData });
      if (!res.ok) throw new Error(`STT API error: ${res.status}`);
      const data = await res.json();
      return data.transcript || null;
    } catch (err) {
      console.error('[STT] Backend call failed:', err.message);
      return null;
    } finally {
      setIsSttLoading(false);
    }
  }, [languageCode]);

  // ─── Start Recording (with haptic, TTS cancel & safety timers) ─────────────────
  const startRecording = async (activeMode) => {
    cancelSpeech(); // Rule 24: TTS interruption - immediately cancel any active speech
    navigator.vibrate?.(50); // Short haptic pulse on start
    try {
      setTranscript('');
      setLiveTranscript('');
      transcriptRef.current = '';
      audioChunksRef.current = [];
      setAudioBlob(null);

      const mode = activeMode || talkMode;
      const newSession = {
        sessionId: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        mode,
        startedAt: Date.now(),
        stoppedAt: null,
        transcript: '',
        audioBlob: null,
        language: languageCode,
        stopReason: null,
        state: 'listening'
      };
      voiceSessionRef.current = newSession;
      setVoiceSession(newSession);
      setVoiceState('listening');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      src.connect(ana);
      audioContextRef.current = ctx;
      setAudioContext(ctx);
      setAnalyser(ana);

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const actualMimeType = mimeType || 'audio/webm';
      setAudioMimeType(actualMimeType);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        setVoiceState('transcribing');
        if (voiceSessionRef.current) {
          voiceSessionRef.current.state = 'transcribing';
          setVoiceSession({ ...voiceSessionRef.current });
        }

        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const browserTranscript = transcriptRef.current.trim();
        let finalTranscript = browserTranscript;

        // Sequence: Speech -> interim browser transcript -> recording finalized -> browser recognition stopped -> Sarvam final STT -> canonical transcript
        try {
          if (blob && blob.size > 500) {
            const sttResult = await submitAudioToSTT(blob, actualMimeType);
            if (sttResult && sttResult.trim()) {
              finalTranscript = sttResult.trim();
              transcriptRef.current = finalTranscript;
              setTranscript(finalTranscript);
            }
          }
        } catch (sttErr) {
          console.warn('[Voice Engine] Authoritative Sarvam STT error, falling back to interim transcript:', sttErr.message);
        }

        setAudioBlob(blob);

        if (voiceSessionRef.current) {
          voiceSessionRef.current.transcript = finalTranscript;
          voiceSessionRef.current.audioBlob = blob;
          voiceSessionRef.current.state = 'routing';
          setVoiceSession({ ...voiceSessionRef.current });
        }
        setVoiceState('routing');
        
        if (transcriptPromiseRef.current) {
          transcriptPromiseRef.current.resolve(finalTranscript);
          transcriptPromiseRef.current = null;
        }
      };

      recorder.start(200);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { /* non-fatal */ }
      }
      setIsRecording(true);

      // Rule 16: Hard safety limit - strictly max 5 seconds
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      hasSpokenRef.current = false;

      maxTimerRef.current = setTimeout(() => {
        console.log('[Voice Engine] Maximum recording safety limit reached. Auto-stopping.');
        stopRecording('max_duration_limit');
      }, MAX_RECORDING_MS);

      // Rule 59 & 60: VAD silence detection and instantaneous barge-in interruption
      const dataArray = new Uint8Array(ana.frequencyBinCount);
      vadIntervalRef.current = setInterval(() => {
        if (!ana) return;
        ana.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        if (avg > SPEECH_THRESHOLD) {
          hasSpokenRef.current = true;
          // Barge-in: immediately cut off any active TTS playback when user begins speaking
          if (currentAudioRef.current || window.speechSynthesis?.speaking) {
            console.log('[Voice Engine] Barge-in speech detected! Stopping playback.');
            cancelSpeech();
          }
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpokenRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('[Voice Engine] Silence detected (~1.6s). Auto-stopping recording.');
            stopRecording('silence_detected');
          }, SILENCE_TIMEOUT_MS);
        }
      }, 80);

    } catch (err) {
      console.error('Failed to access microphone:', err);
      setVoiceState('error');
      alert('Microphone access denied or unsupported. Please check device permissions.');
    }
  };

  // ─── Stop Recording (with cleanup & haptic) ───────────────────────────────────
  const stopRecording = (reason = 'user_action') => {
    navigator.vibrate?.([30, 30, 30]); // Triple pulse on stop

    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }

    if (voiceSessionRef.current) {
      voiceSessionRef.current.stoppedAt = Date.now();
      voiceSessionRef.current.stopReason = reason;
      voiceSessionRef.current.state = 'finalizing';
      setVoiceSession({ ...voiceSessionRef.current });
    }
    setVoiceState('finalizing');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Use ref instead of state to avoid stale closure
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== 'closed') {
      ctx.close();
      audioContextRef.current = null;
      setAudioContext(null);
      setAnalyser(null);
    }
    setIsRecording(false);
  };

  // Rule 21: Complete voice cleanup on unmount
  useEffect(() => {
    return () => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) {}
      }
      cancelSpeech();
    };
  }, []);

  // ─── cancelSpeech: stops both backend audio and browser synthesis ─────────────
  const cancelSpeech = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // ─── speakText: browser SpeechSynthesis with Chrome resume fix ───────────────
  const speakText = (text, langCode = 'hi-IN', speed = 1.0, callback = null) => {
    if (!window.speechSynthesis) {
      if (callback) callback();
      return;
    }
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = parseFloat(speed) || 1.0;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      const voices = voicesRef.current;
      if (voices.length > 0) {
        let matchingVoice = null;
        if (langCode.startsWith('hi')) matchingVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
        else if (langCode.startsWith('mr')) matchingVoice = voices.find(v => v.lang.startsWith('mr'));
        else if (langCode.startsWith('ta')) matchingVoice = voices.find(v => v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil'));
        else if (langCode.startsWith('te')) matchingVoice = voices.find(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
        else if (langCode.startsWith('bn')) matchingVoice = voices.find(v => v.lang.startsWith('bn') || v.name.toLowerCase().includes('bengali'));
        else if (langCode.startsWith('gu')) matchingVoice = voices.find(v => v.lang.startsWith('gu') || v.name.toLowerCase().includes('gujarati'));
        else if (langCode.startsWith('kn')) matchingVoice = voices.find(v => v.lang.startsWith('kn') || v.name.toLowerCase().includes('kannada'));
        else if (langCode.startsWith('ml')) matchingVoice = voices.find(v => v.lang.startsWith('ml') || v.name.toLowerCase().includes('malayalam'));
        else if (langCode.startsWith('or')) matchingVoice = voices.find(v => v.lang.startsWith('or') || v.name.toLowerCase().includes('odia'));
        else if (langCode.startsWith('pa')) matchingVoice = voices.find(v => v.lang.startsWith('pa') || v.name.toLowerCase().includes('punjabi'));
        else if (langCode.startsWith('as')) matchingVoice = voices.find(v => v.lang.startsWith('as') || v.name.toLowerCase().includes('assamese'));
        else if (langCode.startsWith('ur')) matchingVoice = voices.find(v => v.lang.startsWith('ur') || v.name.toLowerCase().includes('urdu'));
        else matchingVoice = voices.find(v => v.lang === 'en-IN') || voices.find(v => v.name.toLowerCase().includes('india')) || voices.find(v => v.lang.startsWith('en'));
        if (matchingVoice) utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); if (callback) callback(); };
      utterance.onerror = (err) => { console.error('Speech synthesis error:', err); setIsSpeaking(false); if (callback) callback(); };

      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  // ─── speakWithTTS: Sarvam backend TTS → fallback to browser TTS ──────────────
  const speakWithTTS = async (text, langCode = 'hi-IN', speed = 1.0, callback = null) => {
    if (!text || !text.trim()) { if (callback) callback(); return; }
    setIsSpeaking(true);
    try {
      const res = await fetch(`${API_BASE}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: text.substring(0, 500),
          target_language_code: langCode,
          speed: parseFloat(speed) || 1.0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_content) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_content}`);
          currentAudioRef.current = audio;
          audio.onended = () => { currentAudioRef.current = null; setIsSpeaking(false); if (callback) callback(); };
          audio.onerror = () => { currentAudioRef.current = null; speakText(text, langCode, speed, callback); };
          await audio.play().catch(() => speakText(text, langCode, speed, callback));
          return;
        }
      }
    } catch (err) {
      console.warn('[TTS] Backend TTS request failed:', err.message);
    }
    speakText(text, langCode, speed, callback);
  };

  // ─── TTS sentence queue for streaming responses ───────────────────────────────
  const playNextInQueue = useCallback(async (langCode, speed) => {
    if (isPlayingRef.current || ttsQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const sentence = ttsQueueRef.current.shift();
    await new Promise((resolve) => {
      speakWithTTS(sentence, langCode, speed, resolve);
    });
    isPlayingRef.current = false;
    playNextInQueue(langCode, speed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearTTSQueue = useCallback(() => {
    ttsQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  /**
   * streamAndSpeak — calls /api/ai/chat-stream (SSE) and:
   *   1. Streams tokens to onToken(text) for live display
   *   2. Pipes sentence-boundary chunks to TTS queue for sequential speech
   *   3. Calls onDone() when stream completes
   */
  const streamAndSpeak = useCallback(async ({
    messages,
    langCode = 'hi-IN',
    speed = 1.0,
    onToken,
    onTTSSentence,
    onDone,
    signal, // Add AbortSignal for interruptions
  }) => {
    clearTTSQueue();
    cancelSpeech();

    try {
      const response = await fetch(`${API_BASE}/ai/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages, language_code: langCode }),
        signal, // Pass the signal to fetch
      });

      if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.replace('data: ', '').trim();
          if (raw === '[DONE]') { if (onDone) onDone(); return; }

          try {
            const data = JSON.parse(raw);
            if (data.token && onToken) onToken(data.token);
            if (data.tts_sentence) {
              ttsQueueRef.current.push(data.tts_sentence);
              playNextInQueue(langCode, speed);
              if (onTTSSentence) onTTSSentence(data.tts_sentence);
            }
          } catch {}
        }
      }
      if (onDone) onDone();
    } catch (err) {
      console.error('[streamAndSpeak] Error:', err);
      if (err.name !== 'AbortError' && onDone) onDone();
    }
  }, [clearTTSQueue, playNextInQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * sendVoiceCommand — POSTs audio blob/metadata to /api/voice/command
   */
  const sendVoiceCommand = useCallback(async (blob, { projectId, languageCode: langOverride } = {}) => {
    const lang = langOverride || languageCode;
    try {
      setIsSttLoading(true);
      const formData = new FormData();
      if (blob) {
        const ext = (audioMimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
        formData.append('file', blob, `command_audio.${ext}`);
      }
      if (projectId) formData.append('projectId', projectId);
      if (lang) formData.append('language_code', lang);

      const res = await fetch(`${API_BASE}/voice/command`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Voice command failed (${res.status})`);
      }

      const data = await res.json();

      // Playback audio response if available, or fall back to browser TTS
      if (data.reply) {
        if (data.audio_content) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_content}`);
          currentAudioRef.current = audio;
          setIsSpeaking(true);
          audio.onended = () => { currentAudioRef.current = null; setIsSpeaking(false); };
          audio.onerror = () => { currentAudioRef.current = null; speakText(data.reply, lang); };
          await audio.play().catch(() => speakText(data.reply, lang));
        } else {
          speakText(data.reply, lang);
        }
      }

      return data;
    } catch (err) {
      console.error('[sendVoiceCommand] Error:', err.message);
      throw err;
    } finally {
      setIsSttLoading(false);
    }
  }, [languageCode, audioMimeType, speakText]);

  /**
   * setExternalAudioBlob — allows VAD to inject audio from Float32Array/WAV blob
   */

  const setExternalAudioBlob = useCallback(async (blob) => {
    if (!blob) return;
    const mimeType = 'audio/wav';
    setAudioMimeType(mimeType);
    let finalTranscript = transcriptRef.current.trim();
    
    // Only call backend STT if the browser's native STT didn't capture anything
    if (!finalTranscript) {
      const sttResult = await submitAudioToSTT(blob, mimeType);
      if (sttResult) {
        finalTranscript = sttResult;
        transcriptRef.current = sttResult;
        setTranscript(sttResult);
      }
    }
    
    setAudioBlob(blob);
    if (transcriptPromiseRef.current) {
      transcriptPromiseRef.current.resolve(finalTranscript);
      transcriptPromiseRef.current = null;
    }
  }, [submitAudioToSTT]);

  // resetAudioBlob — allows components to clear blob after processing
  const resetAudioBlob = useCallback(() => setAudioBlob(null), []);

  const waitForTranscript = useCallback((timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      if (transcriptRef.current.trim()) {
        resolve(transcriptRef.current.trim());
        return;
      }
      transcriptPromiseRef.current = { resolve, reject };
      setTimeout(() => {
        if (transcriptPromiseRef.current && transcriptPromiseRef.current.reject === reject) {
          transcriptPromiseRef.current.reject(new Error('Timeout waiting for transcript'));
          transcriptPromiseRef.current = null;
        }
      }, timeoutMs);
    });
  }, []);

  return {
    isRecording,
    isSttLoading,
    isSpeaking,
    transcript,
    liveTranscript,
    audioBlob,
    audioMimeType,
    audioAnalyser: analyser,
    startRecording,
    stopRecording,
    resetAudioBlob,
    speakText,
    speakWithTTS,
    cancelSpeech,
    streamAndSpeak,
    clearTTSQueue,
    setExternalAudioBlob,
    waitForTranscript,
    startSpeechRecognition,
    stopSpeechRecognition,
    sendVoiceCommand,
    voiceState,
    setVoiceState,
    voiceSession,
    talkMode,
    setTalkMode,
    MAX_RECORDING_MS,
    SILENCE_TIMEOUT_MS,
    // Exports for testing
    getSupportedMimeType,
    submitAudioToSTT,
  };
};

