import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createScheduledAction,
  executeScheduledAction,
  runNow,
  pauseAction,
  resumeAction,
  cancelAction,
  editAction,
  listActions,
  parseTemporalIntent
} from '../services/schedulerService.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Helper to get authenticated user id
const getUserId = (req) => {
  return req.user?.id || req.session?.localUser?.id || req.session?.user?.id;
};

/**
 * POST /api/schedule/parse-intent
 * Detects temporal intent from text or voice query
 */
router.post('/parse-intent', (req, res) => {
  try {
    const { text, timezone = 'Asia/Kolkata' } = req.body;
    const intent = parseTemporalIntent(text, timezone);
    res.json({ success: true, intent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/schedule
 * List all scheduled actions for current user / project / session
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { projectId, sessionId, status } = req.query;

    const actions = await listActions({
      userId,
      projectId: projectId || undefined,
      sessionId: sessionId || undefined,
      status: status || undefined
    });

    res.json({ success: true, actions });
  } catch (err) {
    console.error('[Schedule API] List error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/schedule
 * Create a new scheduled action
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      title,
      actionType = 'research',
      payload,
      schedule,
      timezone = 'Asia/Kolkata',
      projectId = null,
      sessionId = null,
      nextRunAt = null,
      runImmediately = false
    } = req.body;

    if (!title && !payload) {
      return res.status(400).json({ error: 'Title or payload is required' });
    }

    const action = await createScheduledAction({
      userId,
      projectId,
      sessionId,
      title: title || 'Scheduled Action',
      actionType,
      payload,
      schedule: schedule || 'Once',
      timezone,
      nextRunAt,
      runImmediately
    });

    res.status(201).json({ success: true, action });
  } catch (err) {
    console.error('[Schedule API] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/schedule/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const action = await prisma.scheduledAction.findUnique({
      where: { id: req.params.id }
    });

    if (!action) return res.status(404).json({ error: 'Scheduled action not found' });
    if (action.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/schedule/:id/run-now
 * Runs immediately without modifying future schedule
 */
router.post('/:id/run-now', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await runNow(req.params.id, userId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Schedule API] Run now error:', err);
    const status = err.message.includes('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/schedule/:id/pause
 */
router.post('/:id/pause', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const action = await pauseAction(req.params.id, userId);
    res.json({ success: true, action });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/schedule/:id/resume
 */
router.post('/:id/resume', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const action = await resumeAction(req.params.id, userId);
    res.json({ success: true, action });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 500).json({ error: err.message });
  }
});

/**
 * DELETE /api/schedule/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const action = await cancelAction(req.params.id, userId);
    res.json({ success: true, action });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 500).json({ error: err.message });
  }
});

/**
 * PATCH /api/schedule/:id
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const action = await editAction(req.params.id, req.body, userId);
    res.json({ success: true, action });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/schedule/cron-trigger
 * GET /api/schedule/cron-trigger
 * Durable external cron trigger for serverless scale-to-zero environments.
 * Authenticated via Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */
router.all('/cron-trigger', async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (isVercelCron && (process.env.VERCEL || process.env.NODE_ENV === 'production')) ||
    (process.env.NODE_ENV !== 'production' && !cronSecret);

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret or trigger credentials' });
  }

  try {
    const now = new Date();
    const dueActions = await prisma.scheduledAction.findMany({
      where: {
        status: 'scheduled',
        nextRunAt: { lte: now }
      },
      take: 10
    });

    const results = [];
    for (const due of dueActions) {
      console.log(`[Cron Trigger] Executing due action ${due.id}: "${due.title}"`);
      const result = await executeScheduledAction(due.id);
      results.push({ id: due.id, title: due.title, success: result?.success ?? true });
    }

    return res.json({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      actions: results
    });
  } catch (err) {
    console.error('[Cron Trigger Error]:', err);
    return res.status(500).json({ error: 'Cron trigger execution failed', message: err.message });
  }
});

export default router;

