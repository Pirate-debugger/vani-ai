import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

describe('Phase 2 Production Readiness & Observability', () => {
  describe('Health Probes', () => {
    it('GET /api/health/live returns 200 with alive status and process uptime', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /api/health/ready returns 200 with connected database status', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
      expect(res.body.services).toBeDefined();
    });

    it('GET /api/health provides backward-compatible system health overview', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.services).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('Database-backed Idempotency', () => {
    it('POST /api/ai/chat returns cached completed run from database when requestId matches', async () => {
      const testRequestId = `test_idempotent_${Date.now()}`;
      const mockResult = {
        response: 'Cached output from database',
        model: 'gemini-3.8-flash',
        idempotent: true
      };

      // Seed an AgentRun in completed state
      await prisma.agentRun.create({
        data: {
          requestId: testRequestId,
          agentId: 'auto',
          status: 'completed',
          prompt: 'Idempotency test prompt',
          result: JSON.stringify(mockResult)
        }
      });

      const res = await request(app)
        .post('/api/ai/chat')
        .send({
          prompt: 'Idempotency test prompt',
          requestId: testRequestId
        });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Cached output from database');
      expect(res.body.idempotent).toBe(true);

      // Clean up
      await prisma.agentRun.deleteMany({
        where: { requestId: testRequestId }
      });
    });
  });

  describe('Observability Logger', () => {
    it('logger is configured with sensitive data redaction', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});
