import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useVoiceRecorder = (languageCode = 'hi-IN') => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [isSttLoading, setIsSttLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Web Audio elements for visualizer
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);

  // Cached voices list — populated via onvoiceschanged to avoid race condition
  const voicesRef = useRef([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptRef = useRef('');
  const currentAudioRef = useRef(null); // Track currently playing audio element

  // ─── Fix: load voices properly using onvoiceschanged event ───────────────────
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
        if (err.error !== 'no-speech') {
          console.error('Speech Recognition Error:', err.error);
        }
      };

      recognitionRef.current = rec;
    }
  }, [languageCode]);

  // ─── Backend STT fallback ─────────────────────────────────────────────────────
  const submitAudioToSTT = useCallback(async (blob) => {
    if (!blob || blob.size < 1000) return null;
    try {
      setIsSttLoading(true);
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
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

  // ─── Start Recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
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
      setAudioContext(ctx);
      setAnalyser(ana);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const browserTranscript = transcriptRef.current.trim();
        if (!browserTranscript) {
          const sttResult = await submitAudioToSTT(blob);
          if (sttResult) {
            transcriptRef.current = sttResult;
            setTranscript(sttResult);
          }
        }
        setAudioBlob(blob);
      };

      mediaRecorder.start(200);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { /* non-fatal */ }
      }
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access denied or unsupported. Please check device permissions.');
    }
  };

  // ─── Stop Recording ───────────────────────────────────────────────────────────
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
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
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // ─── speakText: browser SpeechSynthesis with Chrome resume fix ───────────────
  const speakText = (text, langCode = 'hi-IN', speed = 1.0, callback = null) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis is unsupported.');
      if (callback) callback();
      return;
    }

    // Chrome bug fix: cancel then resume before new utterance
    window.speechSynthesis.cancel();

    // Small delay to let cancel flush before speaking (Chrome quirk)
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = parseFloat(speed) || 1.0;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      const voices = voicesRef.current;
      if (voices.length > 0) {
        let matchingVoice = null;
        if (langCode.startsWith('hi')) {
          matchingVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
        } else if (langCode.startsWith('mr')) {
          matchingVoice = voices.find(v => v.lang.startsWith('mr') || v.name.toLowerCase().includes('marathi'));
        } else if (langCode.startsWith('ta')) {
          matchingVoice = voices.find(v => v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil'));
        } else {
          matchingVoice =
            voices.find(v => v.lang === 'en-IN') ||
            voices.find(v => v.name.toLowerCase().includes('india')) ||
            voices.find(v => v.lang.startsWith('en'));
        }
        if (matchingVoice) utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (callback) callback();
      };
      utterance.onerror = (err) => {
        console.error('Speech synthesis error:', err);
        setIsSpeaking(false);
        if (callback) callback();
      };

      // Chrome: must resume if paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  // ─── speakWithTTS: Sarvam backend TTS → fallback to browser TTS ──────────────
  // This is the PRIMARY method to call for voice responses.
  const speakWithTTS = async (text, langCode = 'hi-IN', speed = 1.0, callback = null) => {
    if (!text || !text.trim()) {
      if (callback) callback();
      return;
    }

    setIsSpeaking(true);

    try {
      // 1. Call backend TTS (Sarvam Bulbul v3 or simulator)
      const res = await fetch(`${API_BASE}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.substring(0, 500), // Sarvam limit
          target_language_code: langCode,
          speed: parseFloat(speed) || 1.0,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.audio_content) {
          // 2a. Sarvam returned real synthesized audio — play it directly
          console.log('[TTS] Playing Sarvam Bulbul v3 audio');
          const audio = new Audio(`data:audio/wav;base64,${data.audio_content}`);
          currentAudioRef.current = audio;

          audio.onended = () => {
            currentAudioRef.current = null;
            setIsSpeaking(false);
            if (callback) callback();
          };
          audio.onerror = () => {
            console.warn('[TTS] Audio play failed, falling back to browser TTS');
            currentAudioRef.current = null;
            speakText(text, langCode, speed, callback);
          };

          await audio.play().catch(() => {
            // Play promise rejected — use browser TTS
            speakText(text, langCode, speed, callback);
          });
          return;
        }

        // 2b. Simulated TTS (no API key) — use browser TTS
        console.log('[TTS] Simulator mode — using browser speech synthesis');
      }
    } catch (err) {
      console.warn('[TTS] Backend TTS request failed:', err.message);
    }

    // 3. Fallback: browser Web Speech API
    speakText(text, langCode, speed, callback);
  };

  return {
    isRecording,
    isSttLoading,
    isSpeaking,
    transcript,
    liveTranscript,
    audioBlob,
    audioAnalyser: analyser,
    startRecording,
    stopRecording,
    speakText,        // Browser-only (kept for compatibility)
    speakWithTTS,     // PRIMARY: Sarvam backend → browser fallback
    cancelSpeech
  };
};
