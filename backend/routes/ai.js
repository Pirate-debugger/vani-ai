import express from 'express';
import prisma from '../lib/prisma.js';
import { decryptKey } from '../lib/crypto.js';
import { getAIResponse } from '../services/llm.js';
import { streamAIResponse } from '../services/llm-stream.js';

const router = express.Router();

// Helper to resolve Sarvam API key
const getSarvamKey = async (req) => {
  if (req.cachedSarvamKey) return req.cachedSarvamKey;
  const user = req.user || req.session?.localUser;
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
      console.error('Error fetching API key from DB:', err);
    }
  }
  return process.env.SARVAM_API_KEY;
};

/**
 * Chat Completion route (/api/ai/chat)
 * Process prompts using Sarvam Chat Completion, OpenAI, Gemini or local simulator.
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { prompt, messages, language_code, personality, profile } = req.body;
    let userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');

    if (!userPrompt?.trim() && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Prompt or messages are required.' });
    }
    if (userPrompt && userPrompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt too long. Please keep it under 4000 characters.' });
    }

    const response = await getAIResponse({
      messages,
      prompt: userPrompt,
      langCode: language_code || 'hi-IN',
      personality,
      profile,
      sarvamKey: await getSarvamKey(req),
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: process.env.GEMINI_API_KEY
    });

    return res.json(response);
  } catch (error) {
    console.error('LLM / Chat Error:', error);
    return res.status(500).json({ error: 'AI Generation Failed', details: error.message });
  }
});

/**
 * Streaming Chat route (/api/ai/chat-stream)
 * Streams LLM response token by token using Server-Sent Events.
 */
router.post('/chat-stream', async (req, res, next) => {
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
    console.error('[Stream] Fatal error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;
