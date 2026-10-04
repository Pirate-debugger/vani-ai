import express from 'express';
import { isTinyFishConfigured } from '../services/tinyfish.js';

const router = express.Router();

/**
 * GET /api/integrations/status
 * Returns real server-side configuration status for AI providers and third-party tools.
 * NEVER returns actual API keys or secret credentials.
 */
router.get('/status', (req, res) => {
  const tinyfishConfigured = isTinyFishConfigured();
  const sarvamConfigured = Boolean(process.env.SARVAM_API_KEY && process.env.SARVAM_API_KEY.trim());
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  res.json({
    tinyfish: {
      status: tinyfishConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      configured: tinyfishConfigured,
      name: 'TinyFish Web Agent & Search',
      description: 'Autonomous web research, live search grounding, and website inspection',
      capabilities: ['search', 'fetch', 'web-agent']
    },
    sarvam: {
      status: sarvamConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      configured: sarvamConfigured,
      name: 'Sarvam AI',
      description: 'Speech-to-Text (Saaras), Text-to-Speech (Bulbul), and Translation (Mayura)',
      capabilities: ['stt', 'tts', 'translate', 'indic-llm']
    },
    gemini: {
      status: geminiConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      configured: geminiConfigured,
      name: 'Google Gemini',
      description: 'Long-context reasoning, BRD/PRD synthesis, and structured JSON extraction',
      capabilities: ['reasoning', 'document-generation', 'structured-output']
    },
    openai: {
      status: openaiConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      configured: openaiConfigured,
      name: 'OpenAI (GPT-4o)',
      description: 'Secondary reasoning and structured output fallback',
      capabilities: ['reasoning', 'chat']
    },
    google_oauth: {
      status: googleOAuthConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      configured: googleOAuthConfigured,
      name: 'Google OAuth',
      description: 'One-click sign in with Google account',
      capabilities: ['authentication']
    },
    github: {
      status: 'COMING_SOON',
      configured: false,
      name: 'GitHub Issues',
      description: 'Sync extracted project tasks to GitHub issues'
    },
    jira: {
      status: 'COMING_SOON',
      configured: false,
      name: 'Jira',
      description: 'Export Epics and User Stories directly to Jira backlog'
    },
    notion: {
      status: 'COMING_SOON',
      configured: false,
      name: 'Notion',
      description: 'Export BRDs, PRDs, and Roadmaps to Notion workspace'
    },
    trello: {
      status: 'COMING_SOON',
      configured: false,
      name: 'Trello',
      description: 'Create Kanban cards from extracted implementation tasks'
    },
    google_docs: {
      status: 'COMING_SOON',
      configured: false,
      name: 'Google Docs',
      description: 'Export requirements documents directly to Google Drive'
    },
    slack: {
      status: 'COMING_SOON',
      configured: false,
      name: 'Slack',
      description: 'Notify team channels when new BRD or tasks are created'
    }
  });
});

export default router;
