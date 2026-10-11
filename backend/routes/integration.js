import express from 'express';
import axios from 'axios';
import { isTinyFishConfigured } from '../services/tinyfish.js';
import { requireAuth } from '../middleware/auth.js';
import mcpClient from '../services/mcpClient.js';

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
  const slackConfigured = Boolean(process.env.SLACK_WEBHOOK_URL);

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
      status: 'AVAILABLE',
      configured: true,
      name: 'GitHub Issues',
      description: 'Sync extracted project tasks directly to GitHub issues with labels',
      capabilities: ['issue_sync', 'backlog_export']
    },
    notion: {
      status: 'AVAILABLE',
      configured: true,
      name: 'Notion Workspace',
      description: 'Export structured BRDs, PRDs, and roadmaps to Notion pages',
      capabilities: ['document_export']
    },
    slack: {
      status: slackConfigured ? 'CONNECTED' : 'AVAILABLE',
      configured: slackConfigured,
      name: 'Slack Notifications',
      description: 'Broadcast new project deliverables and task updates to Slack channels',
      capabilities: ['webhook_notifications']
    },
    mcp: {
      status: 'AVAILABLE',
      configured: true,
      name: 'Model Context Protocol (MCP) Client',
      description: 'Connect external custom tools and data sources via standard MCP protocol',
      capabilities: ['tool_calling', 'custom_sidecars']
    }
  });
});

/**
 * POST /api/integrations/github/sync
 * Syncs project tasks to GitHub Issues
 */
router.post('/github/sync', requireAuth, async (req, res) => {
  const { repo, githubToken, tasks = [] } = req.body;
  if (!repo || !githubToken) {
    return res.status(400).json({ error: 'GitHub repository (owner/repo) and personal access token are required.' });
  }

  const results = [];
  const errors = [];

  for (const task of tasks.slice(0, 15)) {
    try {
      const response = await axios.post(
        `https://api.github.com/repos/${repo}/issues`,
        {
          title: task.title,
          body: `${task.description || ''}\n\n*Created automatically by Vani AI Delivery Manager*`,
          labels: ['vani-ai', task.priority || 'medium']
        },
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Vani-AI-Startup-Copilot'
          },
          timeout: 10000
        }
      );
      results.push({ taskId: task.id, issueUrl: response.data.html_url, issueNumber: response.data.number });
    } catch (err) {
      errors.push({ taskId: task.id, title: task.title, error: err.response?.data?.message || err.message });
    }
  }

  return res.json({
    syncedCount: results.length,
    results,
    errors
  });
});

/**
 * POST /api/integrations/slack/notify
 * Broadcasts an update to a Slack webhook URL
 */
router.post('/slack/notify', requireAuth, async (req, res) => {
  const webhookUrl = req.body.webhookUrl || process.env.SLACK_WEBHOOK_URL;
  const message = req.body.message;

  if (!webhookUrl) {
    return res.status(400).json({ error: 'Slack Webhook URL is required.' });
  }
  if (!message) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    await axios.post(webhookUrl, {
      text: `🎙️ *Vani AI Alert:*\n${message}`
    }, { timeout: 10000 });

    return res.json({ success: true, message: 'Slack notification dispatched' });
  } catch (err) {
    return res.status(502).json({ error: `Slack delivery failed: ${err.message}` });
  }
});

/**
 * POST /api/integrations/mcp/register
 * Registers an external MCP server
 */
router.post('/mcp/register', requireAuth, (req, res) => {
  const { serverId, url, name, headers } = req.body;
  if (!serverId || !url) {
    return res.status(400).json({ error: 'serverId and url are required.' });
  }

  try {
    const server = mcpClient.registerServer(serverId, { url, name, headers });
    return res.json({ success: true, server });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/integrations/mcp/servers
 * Lists registered MCP servers
 */
router.get('/mcp/servers', requireAuth, (req, res) => {
  return res.json({ servers: mcpClient.listServers() });
});

/**
 * POST /api/integrations/mcp/call
 * Invokes a tool on an MCP server
 */
router.post('/mcp/call', requireAuth, async (req, res) => {
  const { serverId, toolName, arguments: args } = req.body;
  if (!serverId || !toolName) {
    return res.status(400).json({ error: 'serverId and toolName are required.' });
  }

  try {
    const result = await mcpClient.callTool(serverId, toolName, args);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

export default router;
