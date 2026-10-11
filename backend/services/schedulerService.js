import prisma from '../lib/prisma.js';
import { orchestrate } from './orchestrator.js';

/**
 * Parses user input for temporal intent (schedule, recurring tasks, reminders).
 * Examples:
 * - "Every Monday at 8 AM, research PG competitors"
 * - "Remind me tomorrow at 8 PM to revise NIMCET maths"
 * - "Check this again in 2 hours"
 * - "Every morning at 8:00 AM check competitor changes"
 */
export function parseTemporalIntent(text, defaultTimezone = 'Asia/Kolkata') {
  if (!text || typeof text !== 'string') return { hasTemporalIntent: false };

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  let actionType = 'research';
  if (lower.includes('competitor watch') || lower.includes('monitor competitor') || lower.includes('track competitor') || (lower.includes('competitor') && lower.includes('monitor'))) {
    actionType = 'competitor_watch';
  } else if (lower.includes('remind') || lower.includes('reminder') || lower.includes('revise')) {
    actionType = 'reminder';
  } else if (lower.includes('brd') || lower.includes('business requirement')) {
    actionType = 'brd';
  } else if (lower.includes('prd') || lower.includes('product requirement')) {
    actionType = 'prd';
  } else if (lower.includes('task') || lower.includes('roadmap')) {
    actionType = 'task_sync';
  } else if (lower.includes('research') || lower.includes('check') || lower.includes('competitor') || lower.includes('monitor')) {
    actionType = 'research';
  }

  // 1. "Every Monday / Sunday / etc. [at HH:MM AM/PM]"
  const weeklyMatch = lower.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (weeklyMatch) {
    const dayName = weeklyMatch[1].charAt(0).toUpperCase() + weeklyMatch[1].slice(1).toLowerCase();
    const hour = weeklyMatch[2] ? parseInt(weeklyMatch[2], 10) : 8;
    const minute = weeklyMatch[3] ? parseInt(weeklyMatch[3], 10) : 0;
    const meridiem = weeklyMatch[4] ? weeklyMatch[4].toLowerCase() : (hour < 12 ? 'am' : 'pm');
    
    let normHour = hour;
    if (meridiem === 'pm' && normHour < 12) normHour += 12;
    if (meridiem === 'am' && normHour === 12) normHour = 0;

    const scheduleStr = `Every ${dayName} at ${hour}:${minute < 10 ? '0' + minute : minute} ${meridiem.toUpperCase()}`;
    const nextRun = computeNextWeekly(dayName, normHour, minute, defaultTimezone);

    return {
      hasTemporalIntent: true,
      actionType,
      isRecurring: true,
      schedule: scheduleStr,
      timezone: defaultTimezone,
      nextRunAt: nextRun,
      title: extractActionTitle(trimmed, scheduleStr),
      prompt: extractExecutablePrompt(trimmed, actionType)
    };
  }

  // 2. "Every morning / Every day [at HH:MM AM/PM]"
  const dailyMatch = lower.match(/every\s+(morning|day|evening|night)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (dailyMatch) {
    const period = dailyMatch[1];
    let defaultHour = 8;
    let defaultMeridiem = 'am';
    if (period === 'evening' || period === 'night') {
      defaultHour = 8;
      defaultMeridiem = 'pm';
    }
    const hour = dailyMatch[2] ? parseInt(dailyMatch[2], 10) : defaultHour;
    const minute = dailyMatch[3] ? parseInt(dailyMatch[3], 10) : 0;
    const meridiem = dailyMatch[4] ? dailyMatch[4].toLowerCase() : defaultMeridiem;

    let normHour = hour;
    if (meridiem === 'pm' && normHour < 12) normHour += 12;
    if (meridiem === 'am' && normHour === 12) normHour = 0;

    const scheduleStr = `Every ${period} at ${hour}:${minute < 10 ? '0' + minute : minute} ${meridiem.toUpperCase()}`;
    const nextRun = computeNextDaily(normHour, minute, defaultTimezone);

    return {
      hasTemporalIntent: true,
      actionType,
      isRecurring: true,
      schedule: scheduleStr,
      timezone: defaultTimezone,
      nextRunAt: nextRun,
      title: extractActionTitle(trimmed, scheduleStr),
      prompt: extractExecutablePrompt(trimmed, actionType)
    };
  }

  // 3. "in X hours / X minutes"
  const inIntervalMatch = lower.match(/(?:check this (?:again )?in|in)\s+(\d+)\s*(hour|minute|hr|min|second|sec)s?/i);
  if (inIntervalMatch) {
    const amount = parseInt(inIntervalMatch[1], 10);
    const unit = inIntervalMatch[2].toLowerCase();
    let ms = amount * 60 * 1000;
    if (unit.startsWith('hour') || unit === 'hr') ms = amount * 3600 * 1000;
    if (unit.startsWith('sec')) ms = amount * 1000;

    const nextRun = new Date(Date.now() + ms);
    const scheduleStr = `In ${amount} ${unit}${amount > 1 ? 's' : ''}`;

    return {
      hasTemporalIntent: true,
      actionType,
      isRecurring: false,
      schedule: scheduleStr,
      timezone: defaultTimezone,
      nextRunAt: nextRun,
      title: extractActionTitle(trimmed, scheduleStr),
      prompt: extractExecutablePrompt(trimmed, actionType)
    };
  }

  // 4. "Tomorrow at HH:MM AM/PM"
  const tomorrowMatch = lower.match(/tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1] ? parseInt(tomorrowMatch[1], 10) : 9;
    const minute = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
    const meridiem = tomorrowMatch[3] ? tomorrowMatch[3].toLowerCase() : (hour < 12 ? 'am' : 'pm');

    let normHour = hour;
    if (meridiem === 'pm' && normHour < 12) normHour += 12;
    if (meridiem === 'am' && normHour === 12) normHour = 0;

    const scheduleStr = `Tomorrow at ${hour}:${minute < 10 ? '0' + minute : minute} ${meridiem.toUpperCase()}`;
    const nextRun = computeTomorrow(normHour, minute, defaultTimezone);

    return {
      hasTemporalIntent: true,
      actionType,
      isRecurring: false,
      schedule: scheduleStr,
      timezone: defaultTimezone,
      nextRunAt: nextRun,
      title: extractActionTitle(trimmed, scheduleStr),
      prompt: extractExecutablePrompt(trimmed, actionType)
    };
  }

  return { hasTemporalIntent: false };
}

function extractActionTitle(text, scheduleStr) {
  let cleaned = text
    .replace(/^(vani,?\s*|please\s*)/i, '')
    .replace(/(every\s+\w+(\s+at\s+[\d:]+\s*(?:am|pm)?)?)/i, '')
    .replace(/(remind me tomorrow(\s+at\s+[\d:]+\s*(?:am|pm)?)?(\s+to)?)/i, '')
    .replace(/(check this (?:again )?in\s+\d+\s*\w+)/i, '')
    .trim();

  if (!cleaned || cleaned.length < 3) {
    cleaned = 'Scheduled Automation';
  } else {
    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (cleaned.length > 60) cleaned = cleaned.slice(0, 57) + '...';
  }
  return cleaned;
}

function extractExecutablePrompt(text, actionType) {
  let prompt = text
    .replace(/^(vani,?\s*|please\s*)/i, '')
    .replace(/(every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|day|evening|night)(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?,?\s*)/i, '')
    .replace(/(remind me tomorrow(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s*(?:to\s+)?)/i, '')
    .replace(/(check this (?:again )?in\s+\d+\s*\w+,?\s*)/i, '')
    .trim();

  if (actionType === 'research' && !prompt.toLowerCase().includes('research') && !prompt.toLowerCase().includes('competitor')) {
    prompt = `Research: ${prompt}`;
  }
  return prompt || text;
}

/**
 * Computes next occurrence of Day of Week at Hour:Minute
 */
function computeNextWeekly(dayName, targetHour, targetMinute, timezone) {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIdx = daysOfWeek.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
  
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(targetHour, targetMinute);

  const currentDayIdx = now.getDay();
  let diff = targetDayIdx - currentDayIdx;
  if (diff < 0 || (diff === 0 && next <= now)) {
    diff += 7;
  }
  next.setDate(now.getDate() + diff);
  return next;
}

/**
 * Computes next occurrence of daily target Hour:Minute
 */
function computeNextDaily(targetHour, targetMinute, timezone) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(targetHour, targetMinute);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Computes tomorrow at target Hour:Minute
 */
function computeTomorrow(targetHour, targetMinute, timezone) {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(targetHour, targetMinute, 0, 0);
  return next;
}

/**
 * Calculates next recurrence time given schedule definition
 */
export function calculateNextRun(schedule, lastRun = new Date(), timezone = 'Asia/Kolkata') {
  if (!schedule) return null;
  const s = schedule.toLowerCase();

  const weeklyMatch = s.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (weeklyMatch) {
    const day = weeklyMatch[1];
    const hour = weeklyMatch[2] ? parseInt(weeklyMatch[2], 10) : 8;
    const minute = weeklyMatch[3] ? parseInt(weeklyMatch[3], 10) : 0;
    const meridiem = weeklyMatch[4] ? weeklyMatch[4].toLowerCase() : (hour < 12 ? 'am' : 'pm');
    let normHour = hour;
    if (meridiem === 'pm' && normHour < 12) normHour += 12;
    if (meridiem === 'am' && normHour === 12) normHour = 0;
    return computeNextWeekly(day, normHour, minute, timezone);
  }

  const dailyMatch = s.match(/every\s+(morning|day|evening|night)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (dailyMatch) {
    const hour = dailyMatch[2] ? parseInt(dailyMatch[2], 10) : 8;
    const minute = dailyMatch[3] ? parseInt(dailyMatch[3], 10) : 0;
    const meridiem = dailyMatch[4] ? dailyMatch[4].toLowerCase() : 'am';
    let normHour = hour;
    if (meridiem === 'pm' && normHour < 12) normHour += 12;
    if (meridiem === 'am' && normHour === 12) normHour = 0;
    return computeNextDaily(normHour, minute, timezone);
  }

  // Interval e.g. "In 2 hours"
  const inIntervalMatch = s.match(/in\s+(\d+)\s*(hour|minute|hr|min)s?/i);
  if (inIntervalMatch) {
    const amount = parseInt(inIntervalMatch[1], 10);
    const unit = inIntervalMatch[2].toLowerCase();
    const ms = (unit.startsWith('hour') || unit === 'hr') ? amount * 3600000 : amount * 60000;
    return new Date(Date.now() + ms);
  }

  return null; // One-time action completed
}

/**
 * Creates and schedules an action in database
 */
export async function createScheduledAction({
  userId,
  projectId = null,
  sessionId = null,
  title,
  actionType = 'research',
  payload,
  schedule,
  timezone = 'Asia/Kolkata',
  nextRunAt = null,
  runImmediately = false
}) {
  if (!userId) throw new Error('userId is required for scheduling');

  let calculatedNextRun = nextRunAt;
  if (!calculatedNextRun) {
    calculatedNextRun = calculateNextRun(schedule, new Date(), timezone) || new Date(Date.now() + 60000);
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

  const action = await prisma.scheduledAction.create({
    data: {
      userId,
      projectId: projectId || null,
      sessionId: sessionId || null,
      title: title || 'Scheduled Action',
      actionType,
      payload: payloadString,
      schedule: schedule || 'Once',
      timezone,
      status: 'scheduled',
      nextRunAt: new Date(calculatedNextRun)
    }
  });

  if (runImmediately) {
    executeScheduledAction(action.id, { isManualRun: true }).catch(err => {
      console.error(`[Scheduler] Immediate execution failed for ${action.id}:`, err);
    });
  }

  return action;
}

/**
 * Executes a ScheduledAction, pulling session context, project memory, and previous research.
 */
export async function executeScheduledAction(actionId, { isManualRun = false } = {}) {
  const action = await prisma.scheduledAction.findUnique({
    where: { id: actionId },
    include: {
      project: {
        include: {
          memories: true,
          documents: { take: 5, orderBy: { createdAt: 'desc' } }
        }
      },
      session: {
        include: {
          messages: { take: 10, orderBy: { createdAt: 'desc' } }
        }
      },
      user: true
    }
  });

  if (!action) throw new Error(`ScheduledAction not found: ${actionId}`);
  if (action.status === 'paused' && !isManualRun) {
    console.log(`[Scheduler] Skipping paused action: ${actionId}`);
    return null;
  }
  if (action.status === 'cancelled') {
    console.log(`[Scheduler] Skipping cancelled action: ${actionId}`);
    return null;
  }

  // Set status to running
  await prisma.scheduledAction.update({
    where: { id: actionId },
    data: { status: 'running' }
  });

  let payload = {};
  try {
    payload = JSON.parse(action.payload || '{}');
  } catch {
    payload = { prompt: action.payload };
  }

  const executionStartTime = Date.now();
  let executionResult = null;
  let executionError = null;

  try {
    console.log(`[Scheduler] Executing action ${actionId} ("${action.title}") type: ${action.actionType}`);

    // If research or competitor check: execute real agent with TinyFish & synthesize findings
    if (action.actionType === 'research' || action.actionType === 'competitor_check') {
      const promptToRun = payload.prompt || action.title;

      // Extract prior project research findings for comparison
      const previousMemories = action.project?.memories?.filter(m => m.type === 'knowledge' || m.type === 'source') || [];
      const priorResearchSummary = previousMemories.map(m => `- ${m.title}: ${m.content}`).slice(0, 5).join('\n');

      const enrichedPrompt = priorResearchSummary
        ? `${promptToRun}\n\n[Context: Compare findings with previous research state below]:\n${priorResearchSummary}`
        : promptToRun;

      const orchestrateRes = await orchestrate({
        prompt: enrichedPrompt,
        agentType: 'research',
        projectId: action.projectId,
        userId: action.userId,
        requestId: `scheduled_${action.id}_${Date.now()}`
      });

      executionResult = {
        summary: orchestrateRes?.response || orchestrateRes?.summary || 'Research completed successfully.',
        claims: orchestrateRes?.claims || [],
        sources: orchestrateRes?.sources || [],
        executedAt: new Date().toISOString()
      };

      // Persist meaningful findings into ProjectMemory if project exists
      if (action.projectId && orchestrateRes?.sources?.length) {
        await prisma.projectMemory.create({
          data: {
            projectId: action.projectId,
            type: 'knowledge',
            title: `Scheduled Research: ${action.title}`,
            content: (orchestrateRes.response || '').slice(0, 1000),
            category: 'scheduled_research',
            confidence: 'high'
          }
        });
      }
    } else if (action.actionType === 'reminder') {
      // Create notification event / memory
      executionResult = {
        message: `Reminder triggered: ${action.title}`,
        note: payload.note || payload.prompt || action.title,
        executedAt: new Date().toISOString()
      };

      if (action.projectId) {
        await prisma.projectMemory.create({
          data: {
            projectId: action.projectId,
            type: 'knowledge',
            title: `Reminder: ${action.title}`,
            content: payload.note || payload.prompt || action.title,
            category: 'reminder'
          }
        });
      }
    } else if (action.actionType === 'brd' || action.actionType === 'prd') {
      const docRes = await orchestrate({
        prompt: payload.prompt || `Generate updated ${action.actionType.toUpperCase()} for ${action.title}`,
        agentType: action.actionType,
        projectId: action.projectId,
        userId: action.userId,
        requestId: `scheduled_doc_${action.id}_${Date.now()}`
      });

      executionResult = {
        documentId: docRes?.documentId || null,
        documentTitle: docRes?.documentTitle || null,
        tasksCreated: docRes?.tasks?.length || 0,
        executedAt: new Date().toISOString()
      };
    } else if (action.actionType === 'competitor_watch') {
      const orchestrateRes = await orchestrate({
        prompt: payload.prompt || `Monitor competitor offerings, pricing changes, and market shifts for: ${action.title}`,
        agentType: 'research',
        projectId: action.projectId,
        userId: action.userId,
        requestId: `watch_${action.id}_${Date.now()}`
      });

      const currentContent = orchestrateRes?.response || '';
      let hasDiff = false;
      let diffSummary = 'Initial competitor benchmark established.';

      if (action.lastResult) {
        try {
          const prev = JSON.parse(action.lastResult);
          if (prev.summary && prev.summary !== currentContent.slice(0, 500)) {
            hasDiff = true;
            diffSummary = `Competitor update detected: Changes observed in pricing or features compared to previous check.`;
          }
        } catch {}
      }

      executionResult = {
        summary: currentContent.slice(0, 500),
        diffDetected: hasDiff,
        diffSummary,
        sources: orchestrateRes?.sources || [],
        executedAt: new Date().toISOString()
      };

      if (action.projectId) {
        await prisma.projectMemory.create({
          data: {
            projectId: action.projectId,
            type: hasDiff ? 'decision' : 'knowledge',
            title: hasDiff ? `🚨 Competitor Alert: ${action.title}` : `Competitor Benchmark: ${action.title}`,
            content: `${diffSummary}\n\n${currentContent.slice(0, 1000)}`,
            category: 'competitor_watch',
            confidence: 'high'
          }
        });
      }
    } else {
      // General custom execution
      executionResult = {
        status: 'executed',
        title: action.title,
        executedAt: new Date().toISOString()
      };
    }

  } catch (err) {
    console.error(`[Scheduler] Execution error for action ${actionId}:`, err);
    executionError = err.message;
  }

  // Update schedule status & next execution
  const nextRun = calculateNextRun(action.schedule, new Date(), action.timezone);
  const nextStatus = executionError
    ? (action.retryCount >= 3 ? 'failed' : 'scheduled')
    : (nextRun ? 'scheduled' : 'completed');

  const updatedAction = await prisma.scheduledAction.update({
    where: { id: actionId },
    data: {
      status: nextStatus,
      lastRunAt: new Date(),
      lastResult: JSON.stringify(executionResult || { error: executionError }),
      retryCount: executionError ? action.retryCount + 1 : 0,
      nextRunAt: nextRun ? nextRun : action.nextRunAt
    }
  });

  return {
    success: !executionError,
    action: updatedAction,
    result: executionResult,
    error: executionError,
    durationMs: Date.now() - executionStartTime
  };
}

/**
 * Run Now: executes scheduled action immediately without destroying future schedule
 */
export async function runNow(actionId, userId) {
  const action = await prisma.scheduledAction.findUnique({
    where: { id: actionId }
  });
  if (!action) throw new Error('Scheduled action not found');
  if (action.userId !== userId) throw new Error('Forbidden: You do not own this action');

  return executeScheduledAction(actionId, { isManualRun: true });
}

export async function pauseAction(actionId, userId) {
  const action = await prisma.scheduledAction.findUnique({ where: { id: actionId } });
  if (!action) throw new Error('Scheduled action not found');
  if (action.userId !== userId) throw new Error('Forbidden: You do not own this action');

  return prisma.scheduledAction.update({
    where: { id: actionId },
    data: { status: 'paused' }
  });
}

export async function resumeAction(actionId, userId) {
  const action = await prisma.scheduledAction.findUnique({ where: { id: actionId } });
  if (!action) throw new Error('Scheduled action not found');
  if (action.userId !== userId) throw new Error('Forbidden: You do not own this action');

  const nextRun = calculateNextRun(action.schedule, new Date(), action.timezone) || new Date(Date.now() + 60000);
  return prisma.scheduledAction.update({
    where: { id: actionId },
    data: { status: 'scheduled', nextRunAt: nextRun }
  });
}

export async function cancelAction(actionId, userId) {
  const action = await prisma.scheduledAction.findUnique({ where: { id: actionId } });
  if (!action) throw new Error('Scheduled action not found');
  if (action.userId !== userId) throw new Error('Forbidden: You do not own this action');

  return prisma.scheduledAction.update({
    where: { id: actionId },
    data: { status: 'cancelled' }
  });
}

export async function editAction(actionId, updates, userId) {
  const action = await prisma.scheduledAction.findUnique({ where: { id: actionId } });
  if (!action) throw new Error('Scheduled action not found');
  if (action.userId !== userId) throw new Error('Forbidden: You do not own this action');

  const dataToUpdate = {};
  if (updates.title) dataToUpdate.title = updates.title;
  if (updates.actionType) dataToUpdate.actionType = updates.actionType;
  if (updates.payload) {
    dataToUpdate.payload = typeof updates.payload === 'string' ? updates.payload : JSON.stringify(updates.payload);
  }
  if (updates.schedule) {
    dataToUpdate.schedule = updates.schedule;
    dataToUpdate.nextRunAt = calculateNextRun(updates.schedule, new Date(), updates.timezone || action.timezone) || action.nextRunAt;
  }
  if (updates.timezone) dataToUpdate.timezone = updates.timezone;

  return prisma.scheduledAction.update({
    where: { id: actionId },
    data: dataToUpdate
  });
}

export async function listActions({ userId, projectId, sessionId, status }) {
  const where = { userId };
  if (projectId) where.projectId = projectId;
  if (sessionId) where.sessionId = sessionId;
  if (status) where.status = status;

  return prisma.scheduledAction.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Background daemon to poll and execute due scheduled actions
 */
let daemonTimer = null;

export function startSchedulerDaemon() {
  if (daemonTimer) return;
  console.log('[Scheduler] Background Temporal Action Daemon initialized (polling every 30s)');

  daemonTimer = setInterval(async () => {
    try {
      const now = new Date();
      const dueActions = await prisma.scheduledAction.findMany({
        where: {
          status: 'scheduled',
          nextRunAt: { lte: now }
        },
        take: 5
      });

      for (const due of dueActions) {
        console.log(`[Scheduler Daemon] Triggering due action ${due.id}: "${due.title}"`);
        await executeScheduledAction(due.id);
      }
    } catch (err) {
      console.error('[Scheduler Daemon] Polling error:', err.message);
    }
  }, 30000);
}

export function stopSchedulerDaemon() {
  if (daemonTimer) {
    clearInterval(daemonTimer);
    daemonTimer = null;
  }
}
