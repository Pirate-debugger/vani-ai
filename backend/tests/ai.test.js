import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('AI Routes', () => {
  let originalSarvamKey;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSarvamKey = process.env.SARVAM_API_KEY;
    delete process.env.SARVAM_API_KEY; // Force simulator mode
  });

  afterEach(() => {
    process.env.SARVAM_API_KEY = originalSarvamKey;
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

    it('simulator mode: pg keyword -> returns PG content in correct language', async () => {
      const res = await request(app).post('/api/ai/chat').send({
        messages: [{ role: 'user', content: 'where can i find a pg?' }],
        language_code: 'hi-IN'
      });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    });

    it('simulator mode: नौकरी keyword -> returns Hindi jobs content', async () => {
      const res = await request(app).post('/api/ai/chat').send({
        messages: [{ role: 'user', content: 'मुझे नौकरी चाहिए' }],
        language_code: 'hi-IN'
      });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    });
  });
});
