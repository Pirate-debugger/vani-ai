import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Voice Routes', () => {
  let originalSarvamKey;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSarvamKey = process.env.SARVAM_API_KEY;
    delete process.env.SARVAM_API_KEY; // Force simulator mode
  });

  afterEach(() => {
    process.env.SARVAM_API_KEY = originalSarvamKey;
  });

  describe('POST /api/voice/stt', () => {
    it('no file -> 400', async () => {
      const res = await request(app).post('/api/voice/stt');
      expect(res.status).toBe(400);
    });

    it('non-audio file -> 415', async () => {
      const buffer = Buffer.from('hello world');
      const res = await request(app)
        .post('/api/voice/stt')
        .attach('file', buffer, 'test.txt');
      expect(res.status).toBe(415);
    });

    it('no API key -> returns simulated response', async () => {
      const buffer = Buffer.from('fake-audio-data');
      const res = await request(app)
        .post('/api/voice/stt')
        .attach('file', buffer, 'test.wav');
      expect(res.status).toBe(200);
      expect(res.body.transcript).toBeDefined();
    });
  });

  describe('POST /api/voice/tts', () => {
    it('no text -> 400', async () => {
      const res = await request(app).post('/api/voice/tts').send({ text: '' });
      expect(res.status).toBe(400);
    });

    it('no API key -> returns simulated response with simulated:true', async () => {
      const res = await request(app).post('/api/voice/tts').send({ text: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.simulated).toBe(true);
    });
  });

  describe('POST /api/voice/translate', () => {
    it('no input -> 400', async () => {
      const res = await request(app).post('/api/voice/translate').send({ input: '' });
      expect(res.status).toBe(400);
    });

    it('no API key -> returns mock translation', async () => {
      const res = await request(app).post('/api/voice/translate').send({ input: 'Hello', target_language_code: 'hi-IN' });
      expect(res.status).toBe(200);
      expect(res.body.translated_text).toBeDefined();
    });
  });

  describe('POST /api/voice/bridge', () => {
    it('no audioBase64 -> 400', async () => {
      const res = await request(app).post('/api/voice/bridge').send({});
      expect(res.status).toBe(400);
    });

    it('no API key -> 400 with clear error', async () => {
      const res = await request(app).post('/api/voice/bridge').send({ audioBase64: 'fake-base64', sourceLang: 'en-IN', targetLang: 'hi-IN' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });
  });
});
