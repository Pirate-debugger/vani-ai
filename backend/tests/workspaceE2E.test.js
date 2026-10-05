import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import aiRouter from '../routes/ai.js';
import prisma from '../lib/prisma.js';

describe('Vani Workspace End-to-End Acceptance Tests', () => {
  let app;
  let testUserA;
  let testUserB;
  let testProjectA;
  let testProjectB;

  beforeEach(async () => {
    // Clean database
    await prisma.task.deleteMany({});
    await prisma.documentVersion.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    // Create User A and Project A
    testUserA = await prisma.user.create({
      data: {
        email: `usera_${Date.now()}@example.com`,
        name: 'User A',
        passwordHash: 'dummy'
      }
    });

    testProjectA = await prisma.project.create({
      data: {
        userId: testUserA.id,
        name: 'PG Finder Project A',
        description: 'Accommodation search app'
      }
    });

    // Create User B and Project B
    testUserB = await prisma.user.create({
      data: {
        email: `userb_${Date.now()}@example.com`,
        name: 'User B',
        passwordHash: 'dummy'
      }
    });

    testProjectB = await prisma.project.create({
      data: {
        userId: testUserB.id,
        name: 'Secret Project B',
        description: 'Confidential'
      }
    });

    // Setup express app with testUserA injected into session
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = { localUser: testUserA };
      next();
    });
    app.use('/api/ai', aiRouter);
  });

  it('Scenario 1: BRD Agent generation with research, persistence, and task extraction', async () => {
    const res = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Vani, mere PG Finder startup ka detailed BRD bana do aur current competitors research karo.',
        projectId: testProjectA.id,
        language_code: 'hi-IN'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const sseText = res.text;
    expect(sseText).toContain('agent.started');
    expect(sseText).toContain('"agent":"brd"');
    expect(sseText).toContain('agent.step');
    expect(sseText).toContain('agent.completed');

    // Verify document was persisted in database
    const savedDoc = await prisma.document.findFirst({
      where: { projectId: testProjectA.id, type: 'brd' }
    });
    expect(savedDoc).toBeTruthy();
    expect(savedDoc.title).toBeTruthy();
    expect(savedDoc.content).toContain('Executive Summary');

    // Verify tasks were automatically extracted and saved
    const savedTasks = await prisma.task.findMany({
      where: { projectId: testProjectA.id }
    });
    expect(savedTasks.length).toBeGreaterThan(0);
  }, 90000);

  it('Scenario 2: Research Agent only flow - does not create BRD document', async () => {
    const res = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Search the current PG finder competitors and compare their pricing.',
        projectId: testProjectA.id,
        language_code: 'en-IN'
      });

    expect(res.status).toBe(200);
    const sseText = res.text;
    expect(sseText).toContain('"agent":"research"');

    // Verify no BRD document was created
    const savedDoc = await prisma.document.findFirst({
      where: { projectId: testProjectA.id, type: 'brd' }
    });
    expect(savedDoc).toBeNull();
  }, 60000);

  it('Scenario 3: Normal Chat/Technical flow - simple streamed response without BRD or TinyFish', async () => {
    const res = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Explain React state management.',
        language_code: 'en-IN'
      });

    expect(res.status).toBe(200);
    const sseText = res.text;
    expect(sseText).toContain('final.result');
    expect(sseText).not.toContain('tinyfish.search');

    // Verify no document was created
    const docCount = await prisma.document.count();
    expect(docCount).toBe(0);
  }, 60000);

  it('Scenario 4: Conversational question - explain normalization in DBMS', async () => {
    const res = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Vani, explain normalization in DBMS.',
        language_code: 'en-IN'
      });

    expect(res.status).toBe(200);
    const sseText = res.text;
    expect(sseText).toContain('final.result');
    expect(sseText).toContain('[DONE]');
  }, 60000);

  it('Scenario 5: Security IDOR check - User A cannot execute within User B project', async () => {
    const res = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Generate my confidential BRD',
        projectId: testProjectB.id,
        language_code: 'en-IN'
      });

    expect(res.status).toBe(200);
    const sseText = res.text;
    expect(sseText).toContain('"code":"FORBIDDEN"');

    // Verify no document created in Project B
    const docInB = await prisma.document.findFirst({
      where: { projectId: testProjectB.id }
    });
    expect(docInB).toBeNull();
  });
});
