import express from 'express';
import prisma from '../lib/prisma.js';
// In a full implementation, you'd use libraries like html-pdf-node and docx
// import htmlPdf from 'html-pdf-node';
// import { Document, Packer, Paragraph, TextRun } from 'docx';

const router = express.Router();

router.get('/:id/:format', async (req, res) => {
  const { id, format } = req.params;

  try {
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    if (format === 'md' || format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title.replace(/\s+/g, '_')}.md"`);
      return res.send(document.content);
    }

    if (format === 'pdf') {
      // NOTE: Placeholder for PDF generation
      // This would normally involve converting Markdown -> HTML -> PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title.replace(/\s+/g, '_')}.pdf"`);
      return res.send(`Mock PDF content for ${document.title}`);
    }

    if (format === 'docx') {
      // NOTE: Placeholder for DOCX generation
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title.replace(/\s+/g, '_')}.docx"`);
      return res.send(`Mock DOCX content for ${document.title}`);
    }

    return res.status(400).json({ error: 'Unsupported format' });

  } catch (error) {
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

export default router;
