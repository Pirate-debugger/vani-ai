import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    apiKey: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    }
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  }
}));

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed_pw');
      prisma.user.create.mockResolvedValue({ id: 1, name: 'Test', email: 'test@test.com' });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Test', email: 'test@test.com', password: 'password123'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('duplicate email rejection', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@test.com' });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Test', email: 'test@test.com', password: 'password123'
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('missing fields', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('success', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'password123'
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@test.com', passwordHash: 'hash' });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'wrong'
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Incorrect password/i);
    });

    it('unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/login').send({
        email: 'unknown@test.com', password: 'password'
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/No account found/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('unauthenticated returns 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('authenticated returns user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, name: 'Test', email: 'test@test.com', passwordHash: 'hash' });
      bcrypt.compare.mockResolvedValue(true);

      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ email: 'test@test.com', password: 'pw' });
      
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@test.com');
    });
  });
});
