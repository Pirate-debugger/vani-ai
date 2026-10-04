import express from 'express';
import prisma from '../lib/prisma.js';
import { decryptKey } from '../lib/crypto.js';
import { getAIResponse } from '../services/llm.js';
import { streamAIResponse } from '../services/llm-stream.js';
import { runAgentWorkflow, identifyAgentIntent } from '../services/agentService.js';
import { getAuthUser, verifyProjectOwnership } from '../middleware/auth.js';

const router = express.Router();

// Helper to resolve Sarvam API key
const getSarvamKey = async (req) => {
  if (req.cachedSarvamKey) return req.cachedSarvamKey;
  const user = getAuthUser(req);
  if (user && user.id) {
    try {
      const apiKeyRow = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'sarvam' } }
      });
      if (apiKeyRow && apiKeyRow.encryptedKey) {
        const decrypted = decryptKey(apiKeyRow.encryptedKey);
        req.cachedSarvamKey = decrypted;
        return decrypted;
      }
    } catch (err) {
      console.error('Error fetching API key from DB:', err.message);
    }
  }
  return process.env.SARVAM_API_KEY;
};

// Helper to resolve Gemini API key
const getGeminiKey = async (req) => {
  if (req.cachedGeminiKey) return req.cachedGeminiKey;
  const user = getAuthUser(req);
  if (user && user.id) {
    try {
      const apiKeyRow = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'gemini' } }
      });
      if (apiKeyRow && apiKeyRow.encryptedKey) {
        const decrypted = decryptKey(apiKeyRow.encryptedKey);
        req.cachedGeminiKey = decrypted;
        return decrypted;
      }
    } catch (err) {
      console.error('Error fetching Gemini API key from DB:', err.message);
    }
  }
  return process.env.GEMINI_API_KEY;
};

/**
 * Chat Completion route (/api/ai/chat)
 * Process prompts using Sarvam, OpenAI, Gemini or local simulator.
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, messages, language_code, personality, profile, provider, enableSearch, projectId } = req.body;
    let userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');

    if (!userPrompt?.trim() && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Prompt or messages are required.', code: 'INVALID_INPUT' });
    }
    if (userPrompt && userPrompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt too long. Please keep it under 4000 characters.', code: 'PROMPT_TOO_LONG' });
    }

    const authUser = getAuthUser(req);
    // If projectId provided, verify ownership
    if (projectId && authUser && authUser.id) {
      try {
        await verifyProjectOwnership(projectId, authUser.id);
      } catch (authErr) {
        return res.status(403).json({
          error: 'Access denied: You do not have permission to modify this project.',
          code: 'FORBIDDEN'
        });
      }
    }

    const apiKeys = {
      sarvamKey: await getSarvamKey(req),
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: await getGeminiKey(req)
    };

    let targetAgentType = req.body.agentType;

    // If no explicit agent is requested, route dynamically
    if (!targetAgentType) {
      targetAgentType = await identifyAgentIntent(userPrompt, apiKeys);
      console.log(`[Agent Router] Classified intent as: ${targetAgentType}`);
    }

    let response;
    if (targetAgentType && targetAgentType !== 'general') {
      response = await runAgentWorkflow(
        projectId, 
        targetAgentType, 
        userPrompt, 
        messages, 
        apiKeys
      );
    } else {
      response = await getAIResponse({
        messages,
        prompt: userPrompt,
        langCode: language_code || 'hi-IN',
        personality,
        profile,
        provider,
        enableSearch,
        operationType: 'GENERAL_CHAT',
        ...apiKeys
      });
    }

    return res.json(response);
  } catch (error) {
    console.error('LLM / Chat Error:', error.message);
    return res.status(500).json({
      error: 'AI Generation Failed. Please try again.',
      code: 'AI_GENERATION_FAILED',
      retryable: true
    });
  }
});

/**
 * Streaming Chat route (/api/ai/chat-stream)
 * Streams LLM response token by token using Server-Sent Events.
 */
router.post('/chat-stream', async (req, res) => {
  try {
    const { messages, language_code } = req.body;
    
    await streamAIResponse(
      messages, 
      language_code || 'hi-IN', 
      res, 
      { 
        sarvamKey: await getSarvamKey(req), 
        openaiKey: process.env.OPENAI_API_KEY 
      }
    );
  } catch (error) {
    console.error('[Stream] Fatal error:', error.message);
    res.write(`data: ${JSON.stringify({ error: 'Streaming response failed' })}\n\n`);
    res.end();
  }
});

export default router;
