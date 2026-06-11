import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVoiceRecorder } from '../useVoiceRecorder';

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSupportedMimeType returns a valid MIME type', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    const mimeType = result.current.getSupportedMimeType();
    expect(typeof mimeType).toBe('string');
    expect(mimeType).toBe('audio/webm');
  });

  it('waitForTranscript times out after 3000ms with an error', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useVoiceRecorder());
    
    const promise = result.current.waitForTranscript();
    
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    await expect(promise).rejects.toThrow('Timeout waiting for transcript');
    vi.useRealTimers();
  });

  it('submitAudioToSTT rejects blobs smaller than 1000 bytes', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    const smallBlob = new Blob(['tiny'], { type: 'audio/webm' });
    
    const res = await result.current.submitAudioToSTT(smallBlob, 'audio/webm');
    
    expect(res).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
