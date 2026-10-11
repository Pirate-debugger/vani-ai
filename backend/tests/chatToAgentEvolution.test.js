import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/prisma.js';
import request from 'supertest';
import express from 'express';
import aiRouter from '../routes/ai.js';

describe('Chat-to-Agent Dynamic Evolution Tests (Section 2, 3, 7, 8, 86)', () => {
  let app;
  let testUser;
  let testProject;
  let session;

  beforeEach(async () => {
    await prisma.scheduledAction.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.documentVersion.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.chatMessage.deleteMany({});
    await prisma.chatSession.deleteMany({});
    await prisma.projectMemory.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    testUser = await prisma.user.create({
      data: {
        email: `evolution_user_${Date.now()}@example.com`,
        name: 'Evolution User',
        passwordHash: 'dummy'
      }
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        name: 'PG Finder Evolution Project',
        description: 'Accommodation search startup'
      }
    });

    session = await prisma.chatSession.create({
      data: {
        userId: testUser.id,
        projectId: testProject.id,
        title: 'PG Finder Discussion',
        currentMode: 'auto'
      }
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = { localUser: testUser };
      next();
    });
    app.use('/api/ai', aiRouter);
  });

  it('Stage 1 -> Stage 2 -> Stage 3: Chat becomes Research, then BRD in SAME session without context loss', async () => {
    // -------------------------------------------------------------
    // STAGE 1: Normal conversational chat
    // -------------------------------------------------------------
    const res1 = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Tell me about PG finder startups.',
        sessionId: session.id,
        projectId: testProject.id,
        language_code: 'en-IN'
      });

    expect(res1.status).toBe(200);
    const sse1 = res1.text;
    expect(sse1).toContain('final.result');
    expect(sse1).not.toContain('tinyfish.search');

    // Verify session updated to chat mode
    let updatedSession = await prisma.chatSession.findUnique({
      where: { id: session.id },
      include: { messages: true }
    });
    expect(updatedSession.currentMode).toBe('chat');
    expect(updatedSession.messages.length).toBeGreaterThanOrEqual(2);

    // -------------------------------------------------------------
    // STAGE 2: User requests competitor research -> becomes Research Agent in SAME session
    // -------------------------------------------------------------
    const res2 = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Compare the current PG finder competitors and their models.',
        sessionId: session.id,
        projectId: testProject.id,
        language_code: 'en-IN'
      });

    expect(res2.status).toBe(200);
    const sse2 = res2.text;
    // Section 6: lightweight transition event emitted
    expect(sse2).toContain('agent.transition');
    expect(sse2).toContain('"toMode":"research"');
    expect(sse2).toContain('Live competitor and web research is required');

    updatedSession = await prisma.chatSession.findUnique({
      where: { id: session.id },
      include: { messages: true }
    });
    expect(updatedSession.currentMode).toBe('research');
    expect(updatedSession.messages.length).toBeGreaterThanOrEqual(4);

    // -------------------------------------------------------------
    // STAGE 3: User says "Based on that, create a complete BRD." -> becomes BRD Agent in SAME session
    // -------------------------------------------------------------
    const res3 = await request(app)
      .post('/api/ai/orchestrate-stream')
      .send({
        prompt: 'Based on that, create a complete BRD.',
        sessionId: session.id,
        projectId: testProject.id,
        language_code: 'en-IN'
      });

    expect(res3.status).toBe(200);
    const sse3 = res3.text;
    expect(sse3).toContain('agent.transition');
    expect(sse3).toContain('"toMode":"brd"');
    expect(sse3).toContain('Generating comprehensive Business Requirements Document');

    // Verify BRD was persisted
    const savedBRD = await prisma.document.findFirst({
      where: { projectId: testProject.id, type: 'brd' }
    });
    expect(savedBRD).toBeTruthy();
    expect(savedBRD.title).toBeTruthy();

    // Verify tasks were created
    const tasks = await prisma.task.findMany({
      where: { projectId: testProject.id }
    });
    expect(tasks.length).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // STAGE 4: Verify Session State endpoint for clean Session Resume (Section 10)
    // -------------------------------------------------------------
    const stateRes = await request(app)
      .get(`/api/ai/session/${session.id}/state`);

    expect(stateRes.status).toBe(200);
    expect(stateRes.body.success).toBe(true);
    expect(stateRes.body.session.id).toBe(session.id);
    expect(stateRes.body.session.currentMode).toBe('brd');
    expect(stateRes.body.session.messages.length).toBeGreaterThanOrEqual(6);
    expect(stateRes.body.activeDocument).toBeTruthy();
    expect(stateRes.body.activeDocument.id).toBe(savedBRD.id);
  }, 120000);
});
