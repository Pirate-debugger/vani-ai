import { useState, useRef, useEffect } from 'react';

export const useVoiceRecorder = (languageCode = 'hi-IN') => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  
  // Web Audio elements for visualizer
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize Speech Recognition
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
          setTranscript(prev => prev + ' ' + final);
        }
        setLiveTranscript(interim);
      };

      rec.onerror = (err) => {
        console.error('Speech Recognition Error:', err);
      };

      recognitionRef.current = rec;
    }
  }, [languageCode]);

  // Start Recording & Speech Recognition
  const startRecording = async () => {
    try {
      setTranscript('');
      setLiveTranscript('');
      audioChunksRef.current = [];
      setAudioBlob(null);

      // Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // --- WEB AUDIO API FOR ORB RESPONSIVENESS ---
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      src.connect(ana);
      
      setAudioContext(ctx);
      setAnalyser(ana);

      // --- RECORDING TO BLOB FOR BACKEND STT ---
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      // Start recording processes
      mediaRecorder.start(200); // chunk size ms
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      setIsRecording(true);

    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access denied or unsupported. Please check device permissions.');
    }
  };

  // Stop Recording & Speech Recognition
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }

    setIsRecording(false);
  };

  // Text-To-Speech browser synthesis fallback
  const speakText = (text, langCode = 'hi-IN', speed = 1.0, callback = null) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis is unsupported in this browser.');
      return;
    }

    // Cancel ongoing speak operations
    window.speechSynthesis.cancel();

    // Map language code to browser voices if possible
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = parseFloat(speed);

    // Dynamic voice selection matching Indian voices
    const voices = window.speechSynthesis.getVoices();
    let matchingVoice = null;

    if (langCode.startsWith('hi')) {
      matchingVoice = voices.find(v => v.lang.includes('hi') || v.name.includes('Hindi'));
    } else if (langCode.startsWith('mr')) {
      matchingVoice = voices.find(v => v.lang.includes('mr') || v.name.includes('Marathi'));
    } else if (langCode.startsWith('ta')) {
      matchingVoice = voices.find(v => v.lang.includes('ta') || v.name.includes('Tamil'));
    } else {
      matchingVoice = voices.find(v => v.lang.includes('IN') || v.name.includes('India') || v.name.includes('Google'));
    }

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      if (callback) callback();
    };

    utterance.onerror = (err) => {
      console.error('Speech synthesis error:', err);
      if (callback) callback();
    };

    window.speechSynthesis.speak(utterance);
  };

  const cancelSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  return {
    isRecording,
    transcript,
    liveTranscript,
    audioBlob,
    audioAnalyser: analyser,
    startRecording,
    stopRecording,
    speakText,
    cancelSpeech
  };
};
