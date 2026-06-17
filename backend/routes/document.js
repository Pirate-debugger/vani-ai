import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Get all projects for the current user
router.get('/projects', async (req, res) => {
  const userId = req.user?.id || req.session?.localUser?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        documents: {
          select: { id: true, type: true, title: true, createdAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
  }
});

// Create a new project
router.post('/projects', async (req, res) => {
  const userId = req.user?.id || req.session?.localUser?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { name, description } = req.body;
    const project = await prisma.project.create({
      data: {
        userId,
        name: name || 'New Project',
        description
      }
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project', details: error.message });
  }
});

// Get document by ID
router.get('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { versions: true }
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document', details: error.message });
  }
});

import { runAgentWorkflow } from '../services/agentService.js';
import { decryptKey } from '../lib/crypto.js';

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
    } catch (err) {}
  }
  return process.env.SARVAM_API_KEY;
};

// Convert document
router.post('/:id/convert', async (req, res) => {
  try {
    const { targetType } = req.body;
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const apiKeys = {
      sarvamKey: await getSarvamKey(req),
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: process.env.GEMINI_API_KEY
    };

    const contextMessages = [
      { role: 'user', content: `Source Document Content:\n\n${document.content}` }
    ];

    const response = await runAgentWorkflow(
      document.projectId,
      targetType || 'prd',
      `Please convert the provided source document into a ${targetType || 'PRD'}.`,
      contextMessages,
      apiKeys
    );

    res.json(response);
  } catch (error) {
    console.error('Convert Error:', error);
    res.status(500).json({ error: 'Failed to convert document', details: error.message });
  }
});

export default router;
