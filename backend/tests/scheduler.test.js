import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/prisma.js';
import {
  parseTemporalIntent,
  calculateNextRun,
  createScheduledAction,
  executeScheduledAction,
  runNow,
  pauseAction,
  resumeAction,
  cancelAction,
  editAction,
  listActions
} from '../services/schedulerService.js';
import request from 'supertest';
import express from 'express';
import scheduleRouter from '../routes/schedule.js';
import voiceCommandRouter from '../routes/voiceCommand.js';

describe('Temporal Action Engine & Scheduler Tests', () => {
  let testUser;
  let testProject;
  let app;

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
        email: `sched_user_${Date.now()}@example.com`,
        name: 'Scheduler User',
        passwordHash: 'dummy'
      }
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        name: 'PG Finder Project',
        description: 'PG Finder startup'
      }
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = { localUser: testUser };
      next();
    });
    app.use('/api/schedule', scheduleRouter);
    app.use('/api/voice', voiceCommandRouter);
  });

  describe('parseTemporalIntent', () => {
    it('recognizes "Every Monday at 8 AM, research PG competitors"', () => {
      const intent = parseTemporalIntent(
        'Vani, every Monday at 8 AM, research PG competitors and compare changes with last week',
        'Asia/Kolkata'
      );
      expect(intent.hasTemporalIntent).toBe(true);
      expect(intent.actionType).toBe('research');
      expect(intent.isRecurring).toBe(true);
      expect(intent.schedule).toContain('Every Monday at 8:00 AM');
      expect(intent.timezone).toBe('Asia/Kolkata');
      expect(intent.nextRunAt).toBeInstanceOf(Date);
      expect(intent.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('recognizes "Remind me tomorrow at 8 PM to revise NIMCET maths"', () => {
      const intent = parseTemporalIntent(
        'Vani, remind me tomorrow at 8 PM to revise NIMCET maths',
        'Asia/Kolkata'
      );
      expect(intent.hasTemporalIntent).toBe(true);
      expect(intent.actionType).toBe('reminder');
      expect(intent.isRecurring).toBe(false);
      expect(intent.schedule).toContain('Tomorrow at 8:00 PM');
      expect(intent.nextRunAt).toBeInstanceOf(Date);
      expect(intent.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('recognizes relative interval: "Check this again in 2 hours"', () => {
      const intent = parseTemporalIntent('Check this again in 2 hours');
      expect(intent.hasTemporalIntent).toBe(true);
      expect(intent.schedule).toBe('In 2 hours');
      expect(intent.isRecurring).toBe(false);
      // Roughly 2 hours in the future
      const diffMs = intent.nextRunAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(119 * 60 * 1000);
      expect(diffMs).toBeLessThan(121 * 60 * 1000);
    });

    it('does not trigger on plain conversational questions', () => {
      const intent = parseTemporalIntent('What is normalization in DBMS?');
      expect(intent.hasTemporalIntent).toBe(false);
    });
  });

  describe('CRUD & Lifecycle Operations', () => {
    it('creates, lists, pauses, resumes, and cancels a scheduled action', async () => {
      const action = await createScheduledAction({
        userId: testUser.id,
        projectId: testProject.id,
        title: 'Weekly Competitor Scan',
        actionType: 'research',
        payload: { prompt: 'Scan PG competitors' },
        schedule: 'Every Monday at 8:00 AM',
        timezone: 'Asia/Kolkata'
      });

      expect(action).toBeTruthy();
      expect(action.status).toBe('scheduled');
      expect(action.title).toBe('Weekly Competitor Scan');

      // List
      const list = await listActions({ userId: testUser.id });
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(action.id);

      // Pause
      const paused = await pauseAction(action.id, testUser.id);
      expect(paused.status).toBe('paused');

      // Resume
      const resumed = await resumeAction(action.id, testUser.id);
      expect(resumed.status).toBe('scheduled');

      // Edit
      const edited = await editAction(action.id, { title: 'Updated Weekly Scan' }, testUser.id);
      expect(edited.title).toBe('Updated Weekly Scan');

      // Cancel
      const cancelled = await cancelAction(action.id, testUser.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('Run Now executes immediately and preserves future schedule for recurring actions', async () => {
      const action = await createScheduledAction({
        userId: testUser.id,
        projectId: testProject.id,
        title: 'Daily Competitor Alert',
        actionType: 'reminder',
        payload: { prompt: 'Check pricing alerts' },
        schedule: 'Every morning at 8:00 AM',
        timezone: 'Asia/Kolkata'
      });

      const initialNextRun = new Date(action.nextRunAt);

      // Trigger Run Now
      const execResult = await runNow(action.id, testUser.id);
      expect(execResult.success).toBe(true);

      // Check DB record
      const refreshed = await prisma.scheduledAction.findUnique({
        where: { id: action.id }
      });

      expect(refreshed.lastRunAt).toBeTruthy();
      // Future schedule is maintained (not cancelled or deleted)
      expect(refreshed.status).toBe('scheduled');
      expect(new Date(refreshed.nextRunAt).getTime()).toBeGreaterThanOrEqual(initialNextRun.getTime());
    });
  });

  describe('Voice + Time Temporal Integration (Critical Test Section 70, 87, 88)', () => {
    it('creates exactly one scheduled action and returns spoken confirmation', async () => {
      const res = await request(app)
        .post('/api/voice/command')
        .send({
          transcript: 'Vani, remind me tomorrow at 8 PM to revise NIMCET maths',
          projectId: testProject.id,
          language_code: 'hi-IN',
          timezone: 'Asia/Kolkata'
        });

      expect(res.status).toBe(200);
      expect(res.body.scheduledAction).toBeTruthy();
      expect(res.body.scheduledAction.actionType).toBe('reminder');
      expect(res.body.reply).toContain("Done. I'll remind you Tomorrow at 8:00 PM IST.");

      // Verify exactly one ScheduledAction exists in database
      const actionsInDb = await prisma.scheduledAction.findMany({
        where: { userId: testUser.id }
      });
      expect(actionsInDb.length).toBe(1);
      expect(actionsInDb[0].title).toContain('Revise NIMCET maths');
    });

    it('creates weekly recurring action with confirmation: "Done. I\'ll check it every Sunday at 8:00 PM IST."', async () => {
      const res = await request(app)
        .post('/api/voice/command')
        .send({
          transcript: 'Vani, every Sunday at 8 PM research competitors',
          projectId: testProject.id,
          language_code: 'en-IN',
          timezone: 'Asia/Kolkata'
        });

      expect(res.status).toBe(200);
      expect(res.body.scheduledAction).toBeTruthy();
      expect(res.body.scheduledAction.actionType).toBe('research');
      expect(res.body.reply).toContain("Done. I'll check it Every Sunday at 8:00 PM IST.");
    });
  });
});
