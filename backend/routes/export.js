import express from 'express';
import { requireAuth, verifyDocumentOwnership } from '../middleware/auth.js';

const router = express.Router();

// GET /api/export/:id/:format
// Export a document in Markdown, JSON, Text, or document format (ensures ownership)
router.get('/:id/:format', requireAuth, async (req, res) => {
  const { id, format } = req.params;

  try {
    const document = await verifyDocumentOwnership(id, req.authUser.id);
    const sanitizedTitle = (document.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'md' || format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.md"`);
      return res.send(document.content);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.json"`);
      return res.json({
        id: document.id,
        title: document.title,
        type: document.type,
        content: document.content,
        updatedAt: document.updatedAt
      });
    }

    if (format === 'txt' || format === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.txt"`);
      return res.send(document.content);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.md"`);
      return res.send(document.content);
    }

    if (format === 'docx') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.md"`);
      return res.send(document.content);
    }

    return res.status(400).json({
      error: `Unsupported format '${format}'. Supported: md, json, txt.`,
      code: 'UNSUPPORTED_FORMAT'
    });

  } catch (error) {
    console.error('Export failed:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Export failed',
      code: error.code || 'EXPORT_FAILED'
    });
  }
});

export default router;
