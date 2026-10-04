import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import prisma from '../lib/prisma.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
    }
  }
}));

describe('Security & IDOR Prevention Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated Access Control', () => {
    it('GET /api/projects returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/document/:id returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/document/doc_123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/tasks/:id returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/tasks/task_123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/export/:id/md returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/export/doc_123/md');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Cross-User IDOR Protection', () => {
    it('prevents user A from accessing user B project details', async () => {
      // Mock findFirst returning null because userId does not match
      prisma.project.findFirst.mockResolvedValue(null);

      const agent = request.agent(app);
      // Simulate session for User A
      await agent.post('/api/auth/local-login').send({
        email: 'usera@example.com',
        name: 'User A'
      });

      const res = await agent.get('/api/projects/project_of_user_b');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROJECT_NOT_FOUND');
    });

    it('prevents user A from accessing document of user B', async () => {
      // Document belongs to Project of User B
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc_b',
        title: 'Secret BRD',
        content: 'Confidential',
        project: {
          id: 'proj_b',
          userId: 'user_b_id' // Does not match user A
        }
      });

      const agent = request.agent(app);
      await agent.post('/api/auth/local-login').send({
        email: 'usera@example.com',
        name: 'User A'
      });

      const res = await agent.get('/api/document/doc_b');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('prevents user A from updating task of user B', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_b',
        title: 'Deploy to Prod',
        status: 'pending',
        project: {
          id: 'proj_b',
          userId: 'user_b_id'
        }
      });

      const agent = request.agent(app);
      await agent.post('/api/auth/local-login').send({
        email: 'usera@example.com',
        name: 'User A'
      });

      const res = await agent.patch('/api/tasks/task_b').send({ status: 'done' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('Integrations Status Endpoint Security', () => {
    it('GET /api/integrations/status returns provider statuses without exposing secrets', async () => {
      const res = await request(app).get('/api/integrations/status');
      expect(res.status).toBe(200);
      expect(res.body.tinyfish).toBeDefined();
      expect(res.body.sarvam).toBeDefined();
      expect(res.body.gemini).toBeDefined();
      // Ensure no raw keys are ever returned
      const rawText = JSON.stringify(res.body);
      expect(rawText).not.toContain('sk_');
      expect(rawText).not.toContain('process.env');
    });
  });
});
