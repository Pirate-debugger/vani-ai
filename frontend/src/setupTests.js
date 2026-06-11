import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  window.MediaRecorder = class {
    constructor() {}
    start() {}
    stop() {}
    static isTypeSupported(type) {
      return type === 'audio/webm'; // Mocking browser support
    }
  };
  
  window.AudioContext = class {
    createMediaStreamSource() {}
    createAnalyser() { return { fftSize: 256 }; }
    close() {}
  };
  
  window.speechSynthesis = {
    getVoices: () => [],
    cancel: vi.fn(),
    speak: vi.fn(),
  };

  // Mock global fetch
  global.fetch = vi.fn();
}
