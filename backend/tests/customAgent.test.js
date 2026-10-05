import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import customAgentRoutes from '../routes/customAgent.js';
import prisma from '../lib/prisma.js';

describe('Custom Agent Builder & Execution Integration Tests', () => {
  let app;
  let testUser;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true
    }));

    // Find or create test user
    testUser = await prisma.user.upsert({
      where: { email: 'customagent_tester@vani.ai' },
      update: {},
      create: {
        email: 'customagent_tester@vani.ai',
        name: 'Agent Tester',
        passwordHash: 'dummy_hashed_password'
      }
    });

    // Mock session authentication
    app.use((req, res, next) => {
      req.user = testUser;
      next();
    });

    app.use('/api/agents', customAgentRoutes);
  });

  it('GET /api/agents/templates returns 11 curated agent templates', async () => {
    const res = await request(app).get('/api/agents/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(11);
    
    const names = res.body.map(t => t.name);
    expect(names).toContain('Startup Researcher');
    expect(names).toContain('BRD Analyst');
    expect(names).toContain('Technical Architect');
    expect(names).toContain('Coding Agent');
  });

  it('POST /api/agents/custom creates a custom agent with tools and instructions', async () => {
    const payload = {
      name: 'E2E Testing Agent',
      description: 'Specialized agent for automated test scenarios',
      instructions: 'You are a test verification agent. Always verify claims with test metrics.',
      preferredModel: 'gemini',
      tools: ['web_search', 'web_fetch', 'project_knowledge'],
      autonomy: 'auto_execute',
      language: ['hi', 'en'],
      outputStyle: 'structured'
    };

    const res = await request(app)
      .post('/api/agents/custom')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('E2E Testing Agent');
    expect(res.body.preferredModel).toBe('gemini');
    expect(Array.isArray(res.body.tools)).toBe(true);
    expect(res.body.tools).toContain('web_search');

    // Verify GET /api/agents/custom returns the created agent
    const listRes = await request(app).get('/api/agents/custom');
    expect(listRes.status).toBe(200);
    const found = listRes.body.find(a => a.id === res.body.id);
    expect(found).toBeDefined();
    expect(found.name).toBe('E2E Testing Agent');

    // Clean up
    await request(app).delete(`/api/agents/custom/${res.body.id}`);
  });

  it('POST /api/agents/custom rejects empty name or instructions with 400', async () => {
    const res = await request(app)
      .post('/api/agents/custom')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
