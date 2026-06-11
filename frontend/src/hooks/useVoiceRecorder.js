import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useVoiceRecorder = (languageCode = 'hi-IN') => {
  const [isRecording, setIsRecording]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioBlob, setAudioBlob]       = useState(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [isSttLoading, setIsSttLoading] = useState(false);
  const [isSpeaking, setIsSpeaking]     = useState(false);

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

  // ─── Backend STT fallback ─────────────────────────────────────────────────────
  const submitAudioToSTT = useCallback(async (blob, mimeType) => {
    if (!blob || blob.size < 1000) return null;
    try {
      setIsSttLoading(true);
      const formData = new FormData();
      const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
      formData.append('file', blob, `audio.${ext}`);
      formData.append('language_code', languageCode);
      const res = await fetch(`${API_BASE}/voice/stt`, { method: 'POST', body: formData });
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

  // ─── Start Recording (with haptic) ──────────────────────────────────────────
  const startRecording = async () => {
    navigator.vibrate?.(50); // Short haptic pulse on start
    try {
      setTranscript('');
      setLiveTranscript('');
      transcriptRef.current = '';
      audioChunksRef.current = [];
      setAudioBlob(null);

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
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const browserTranscript = transcriptRef.current.trim();
        let finalTranscript = browserTranscript;
        if (!browserTranscript) {
          const sttResult = await submitAudioToSTT(blob, actualMimeType);
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
      };

      recorder.start(200);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { /* non-fatal */ }
      }
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access denied or unsupported. Please check device permissions.');
    }
  };

  // ─── Stop Recording (with haptic) ─────────────────────────────────────────────
  const stopRecording = () => {
    navigator.vibrate?.([30, 30, 30]); // Triple pulse on stop
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
  }) => {
    clearTTSQueue();
    cancelSpeech();

    try {
      const response = await fetch(`${API_BASE}/ai/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages, language_code: langCode })
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
      if (onDone) onDone();
    }
  }, [clearTTSQueue, playNextInQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * setExternalAudioBlob — allows VAD to inject audio from Float32Array/WAV blob
   */
  const setExternalAudioBlob = useCallback(async (blob) => {
    if (!blob) return;
    const mimeType = 'audio/wav';
    setAudioMimeType(mimeType);
    let finalTranscript = '';
    const sttResult = await submitAudioToSTT(blob, mimeType);
    if (sttResult) {
      finalTranscript = sttResult;
      transcriptRef.current = sttResult;
      setTranscript(sttResult);
    }
    setAudioBlob(blob);
    if (transcriptPromiseRef.current) {
      transcriptPromiseRef.current.resolve(finalTranscript);
      transcriptPromiseRef.current = null;
    }
  }, [submitAudioToSTT]);

  // resetAudioBlob — allows components to clear blob after processing
  const resetAudioBlob = useCallback(() => setAudioBlob(null), []);

  const waitForTranscript = useCallback(() => {
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
      }, 3000);
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
    // Exports for testing
    getSupportedMimeType,
    submitAudioToSTT,
  };
};
