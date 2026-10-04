import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, verifyDocumentOwnership } from '../middleware/auth.js';
import { runAgentWorkflow } from '../services/agentService.js';
import { decryptKey } from '../lib/crypto.js';

const router = express.Router();

// Helper to resolve Sarvam API key
const getSarvamKey = async (req) => {
  if (req.cachedSarvamKey) return req.cachedSarvamKey;
  const user = req.authUser || req.user || req.session?.localUser;
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
      console.error('Error fetching API key:', err.message);
    }
  }
  return process.env.SARVAM_API_KEY;
};

// Helper to resolve Gemini API key
const getGeminiKey = async (req) => {
  if (req.cachedGeminiKey) return req.cachedGeminiKey;
  const user = req.authUser || req.user || req.session?.localUser;
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
      console.error('Error fetching Gemini key:', err.message);
    }
  }
  return process.env.GEMINI_API_KEY;
};

// GET /api/document/projects
// Get all projects for current user
router.get('/projects', requireAuth, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.authUser.id },
      include: {
        documents: {
          select: { id: true, type: true, title: true, createdAt: true, updatedAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects in document route:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects', code: 'PROJECT_FETCH_FAILED' });
  }
});

// POST /api/document/projects
// Create a new project for current user
router.post('/projects', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required', code: 'INVALID_INPUT' });
    }

    const project = await prisma.project.create({
      data: {
        userId: req.authUser.id,
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: 'Failed to create project', code: 'PROJECT_CREATE_FAILED' });
  }
});

// GET /api/document/:id
// Get document by ID (ensures user owns the document's project)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const document = await verifyDocumentOwnership(req.params.id, req.authUser.id);
    res.json(document);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch document',
      code: error.code || 'DOCUMENT_FETCH_FAILED'
    });
  }
});

// POST /api/document/:id/convert
// Convert document from BRD to PRD or other target type (ensures ownership)
router.post('/:id/convert', requireAuth, async (req, res) => {
  try {
    const { targetType } = req.body;
    const document = await verifyDocumentOwnership(req.params.id, req.authUser.id);

    const apiKeys = {
      sarvamKey: await getSarvamKey(req),
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: await getGeminiKey(req)
    };

    const contextMessages = [
      { role: 'user', content: `Source Document Content (${document.type.toUpperCase()}):\n\n${document.content}` }
    ];

    const conversionGoal = `Please convert the provided source ${document.type.toUpperCase()} into a comprehensive ${targetType || 'PRD'} for this project.`;

    const response = await runAgentWorkflow(
      document.projectId,
      targetType || 'prd',
      conversionGoal,
      contextMessages,
      apiKeys
    );

    res.json(response);
  } catch (error) {
    console.error('Convert Error:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to convert document',
      code: error.code || 'CONVERT_FAILED'
    });
  }
});

// PUT /api/document/:id
// Update document content and create a version history snapshot
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { content, title } = req.body;
    const documentId = req.params.id;

    const existing = await verifyDocumentOwnership(documentId, req.authUser.id);

    // Save previous state as version snapshot
    const nextVerNumber = (existing.versions?.length || 0) + 1;
    await prisma.documentVersion.create({
      data: {
        documentId,
        content: existing.content,
        versionName: `v1.${nextVerNumber}`
      }
    });

    // Update document
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        content: content !== undefined ? content : existing.content,
        title: title ? title.trim() : existing.title
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update document error:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to update document',
      code: error.code || 'DOCUMENT_UPDATE_FAILED'
    });
  }
});

// DELETE /api/document/:id
// Delete document (ensures ownership)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const documentId = req.params.id;
    await verifyDocumentOwnership(documentId, req.authUser.id);

    await prisma.document.delete({
      where: { id: documentId }
    });

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to delete document',
      code: error.code || 'DOCUMENT_DELETE_FAILED'
    });
  }
});

// POST /api/document/:id/versions
// Create a new named version of a document
router.post('/:id/versions', requireAuth, async (req, res) => {
  try {
    const { versionName } = req.body;
    const documentId = req.params.id;

    const existing = await verifyDocumentOwnership(documentId, req.authUser.id);

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        content: existing.content,
        versionName: versionName ? versionName.trim() : `v1.${(existing.versions?.length || 0) + 1}`
      }
    });

    res.status(201).json(version);
  } catch (error) {
    console.error('Create version error:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to create document version',
      code: error.code || 'VERSION_CREATE_FAILED'
    });
  }
});

export default router;
