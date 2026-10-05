import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('AI Routes', () => {
  let originalSarvamKey;
  let originalOpenAIKey;
  let originalGeminiKey;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSarvamKey = process.env.SARVAM_API_KEY;
    originalOpenAIKey = process.env.OPENAI_API_KEY;
    originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.SARVAM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalSarvamKey !== undefined) process.env.SARVAM_API_KEY = originalSarvamKey;
    if (originalOpenAIKey !== undefined) process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  describe('POST /api/ai/chat', () => {
    it('empty prompt -> 400', async () => {
      const res = await request(app).post('/api/ai/chat').send({ messages: [] });
      expect(res.status).toBe(400);
    });

    it('prompt too long -> 400', async () => {
      const longMessage = 'a'.repeat(5000);
      const res = await request(app).post('/api/ai/chat').send({ messages: [{ role: 'user', content: longMessage }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too long/i);
    });

    it('unconfigured provider -> truthful 503 PROVIDER_NOT_CONFIGURED (Rule 9)', async () => {
      const res = await request(app).post('/api/ai/chat').send({
        messages: [{ role: 'user', content: 'where can i find a pg?' }],
        language_code: 'hi-IN'
      });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/No AI provider/i);
    });

    it('explicit demo mode: returns demo content when enabled', async () => {
      process.env.VANI_DEMO_MODE = 'true';
      const res = await request(app).post('/api/ai/chat').send({
        messages: [{ role: 'user', content: 'where can i find a pg?' }],
        language_code: 'hi-IN',
        demo: true
      });
      delete process.env.VANI_DEMO_MODE;
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    });
  });
});
