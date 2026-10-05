import express from 'express';
import prisma from '../lib/prisma.js';
import { decryptKey } from '../lib/crypto.js';
import { streamAIResponse } from '../services/llm-stream.js';
import { orchestrate } from '../services/orchestrator.js';
import { getAuthUser, verifyProjectOwnership } from '../middleware/auth.js';
import { getProvidersStatus } from '../services/providers/providerRouter.js';

const router = express.Router();

/**
 * Helper to resolve all 4 AI provider API keys
 * Checks request cache -> User's encrypted DB keys -> process.env fallback
 */
export const resolveUserApiKeys = async (req) => {
  const user = getAuthUser(req);
  const keys = {
    sarvamKey: process.env.SARVAM_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    tinyfishKey: process.env.TINYFISH_API_KEY
  };

  if (user && user.id) {
    try {
      const apiKeyRows = await prisma.apiKey.findMany({
        where: { userId: user.id }
      });

      for (const row of apiKeyRows) {
        if (row.encryptedKey) {
          try {
            const decrypted = decryptKey(row.encryptedKey);
            if (row.provider === 'sarvam') keys.sarvamKey = decrypted;
            if (row.provider === 'openai') keys.openaiKey = decrypted;
            if (row.provider === 'gemini') keys.geminiKey = decrypted;
            if (row.provider === 'tinyfish') keys.tinyfishKey = decrypted;
          } catch (decErr) {
            console.warn(`[Auth] Failed to decrypt key for provider ${row.provider}:`, decErr.message);
          }
        }
      }
    } catch (dbErr) {
      console.error('[Auth] Error fetching user API keys:', dbErr.message);
    }
  }

  return keys;
};

// Idempotency cache to prevent duplicate job execution (Section 77)
const idempotencyCache = new Map();
const cleanupIdempotency = () => {
  const now = Date.now();
  for (const [key, val] of idempotencyCache.entries()) {
    if (now - val.timestamp > 30000) {
      idempotencyCache.delete(key);
    }
  }
};
setInterval(cleanupIdempotency, 60000);

/**
 * Chat Completion route (/api/ai/chat)
 * Process prompts through master orchestrator
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, messages, language_code, personality, profile, projectId, agentType, requestId } = req.body;
    const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');

    // Idempotency check: if requestId already processed recently, return cached response
    if (requestId && idempotencyCache.has(requestId)) {
      const cached = idempotencyCache.get(requestId);
      if (cached.result) return res.json(cached.result);
      if (cached.promise) {
        const waitedResult = await cached.promise;
        return res.json(waitedResult);
      }
    }

    if (!userPrompt?.trim() && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Prompt or messages are required.', code: 'INVALID_INPUT' });
    }
    if (userPrompt && userPrompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt too long. Please keep it under 4000 characters.', code: 'PROMPT_TOO_LONG' });
    }

    const authUser = getAuthUser(req);

    // If projectId provided, verify ownership server-side
    if (projectId && authUser && authUser.id) {
      try {
        await verifyProjectOwnership(projectId, authUser.id);
      } catch (authErr) {
        return res.status(authErr.status || 403).json({
          error: authErr.message || 'Access denied: You do not own this project.',
          code: authErr.code || 'FORBIDDEN'
        });
      }
    }

    const apiKeys = await resolveUserApiKeys(req);

    const result = await orchestrate({
      prompt: userPrompt,
      messages,
      agentType,
      projectId,
      userId: authUser?.id || null,
      languageCode: language_code || 'hi-IN',
      personality,
      profile,
      apiKeys
    });

    if (requestId) {
      idempotencyCache.set(requestId, { result, timestamp: Date.now() });
    }

    return res.json(result);
  } catch (error) {
    console.error('[AI Chat Error]:', error.message);
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || 'AI Generation Failed. Please try again.',
      code: error.code || 'AI_GENERATION_FAILED',
      retryable: status >= 500
    });
  }
});

/**
 * Real-Time Agent Orchestration SSE Endpoint (/api/ai/orchestrate-stream)
 * Streams real-time agent execution events, tool execution, and completed document
 */
router.post('/orchestrate-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const onEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const { prompt, messages, agentType, projectId, language_code, personality, profile, requestId } = req.body;
    const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');

    // Duplicate execution protection (Section 77)
    if (requestId && idempotencyCache.has(requestId)) {
      const cached = idempotencyCache.get(requestId);
      if (cached.inProgress) {
        res.write(`data: ${JSON.stringify({ type: 'info', message: 'Task already executing' })}\n\n`);
        return res.end();
      }
    }

    if (requestId) {
      idempotencyCache.set(requestId, { inProgress: true, timestamp: Date.now() });
    }

    const authUser = getAuthUser(req);

    if (projectId && authUser && authUser.id) {
      try {
        await verifyProjectOwnership(projectId, authUser.id);
      } catch (authErr) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: authErr.message || 'Access denied to this project.', 
          code: 'FORBIDDEN' 
        })}\n\n`);
        res.end();
        return;
      }
    }

    const apiKeys = await resolveUserApiKeys(req);

    const finalResult = await orchestrate({
      prompt: userPrompt,
      messages,
      agentType,
      projectId,
      userId: authUser?.id || null,
      languageCode: language_code || 'hi-IN',
      personality,
      profile,
      apiKeys,
      onEvent
    });

    if (requestId) {
      idempotencyCache.set(requestId, { inProgress: false, result: finalResult, timestamp: Date.now() });
    }

    res.write(`data: ${JSON.stringify({ type: 'final.result', result: finalResult })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Orchestrate Stream Error]:', error.message);
    if (req.body?.requestId) {
      idempotencyCache.delete(req.body.requestId);
    }
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error.message || 'Stream processing failed', 
      code: error.code || 'STREAM_FAILED' 
    })}\n\n`);
    res.end();
  }
});

/**
 * Public Provider Capabilities Status (/api/ai/providers)
 */
router.get('/providers', async (req, res) => {
  const apiKeys = await resolveUserApiKeys(req);
  res.json(getProvidersStatus(apiKeys));
});

/**
 * Streaming Chat route (/api/ai/chat-stream)
 * Streams token by token using SSE
 */
router.post('/chat-stream', async (req, res) => {
  try {
    const { messages, language_code } = req.body;
    const apiKeys = await resolveUserApiKeys(req);
    
    await streamAIResponse(
      messages, 
      language_code || 'hi-IN', 
      res, 
      apiKeys
    );
  } catch (error) {
    console.error('[Stream] Fatal error:', error.message);
    res.write(`data: ${JSON.stringify({ error: 'Streaming response failed' })}\n\n`);
    res.end();
  }
});

export default router;
