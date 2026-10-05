import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';

const router = express.Router();

/**
 * Predefined Agent Templates (Section 26)
 */
export const AGENT_TEMPLATES = [
  {
    id: 'template_researcher',
    name: 'Startup Researcher',
    category: 'Research & Intelligence',
    description: 'Thorough market and competitor researcher prioritizing primary sources and grounded evidence.',
    instructions: `You are an elite Startup Market Researcher.
Rules:
• Always prefer primary sources and verify factual claims.
• Extract competitor pricing, monetization models, and market signals.
• Never invent numbers, market sizes, or citations.
• Group findings into clear themes: Competitors, Pricing, Features, Pain Points.
• Clearly label confidence levels on each piece of evidence.`,
    preferredModel: 'gemini',
    tools: ['web_search', 'web_fetch', 'project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'hi,en',
    outputStyle: 'detailed'
  },
  {
    id: 'template_ba',
    name: 'Business Analyst',
    category: 'Analysis & Strategy',
    description: 'Translates executive goals into structured business requirements and workflow specifications.',
    instructions: `You are a Senior Business Analyst.
Rules:
• Analyze business context, stakeholders, and measurable business objectives.
• Define functional and non-functional requirements with strict FR-xxx/NFR-xxx tagging.
• Map out user journeys and edge-case exceptions.
• Highlight assumptions, dependencies, and business risks.`,
    preferredModel: 'gemini',
    tools: ['project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'structured'
  },
  {
    id: 'template_brd',
    name: 'BRD Analyst',
    category: 'Requirements & Specification',
    description: 'Generates comprehensive 29-section Enterprise Business Requirements Documents with live competitor research.',
    instructions: `You are a specialized BRD Architect.
Rules:
• Construct formal 29-section enterprise specifications.
• Ground requirements in live competitor insights and user personas.
• Detail business rules, acceptance criteria, and KPI milestones.`,
    preferredModel: 'gemini',
    tools: ['web_search', 'web_fetch', 'project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'hi,en',
    outputStyle: 'detailed'
  },
  {
    id: 'template_prd',
    name: 'PRD Builder',
    category: 'Product Management',
    description: 'Transforms high-level business requirements into executable technical product specifications.',
    instructions: `You are a Principal Product Manager.
Rules:
• Define product scope, user stories with Gherkin acceptance criteria, and wireframe flows.
• Outline telemetry metrics, release criteria, and engineering trade-offs.`,
    preferredModel: 'gemini',
    tools: ['project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'structured'
  },
  {
    id: 'template_startup_strategist',
    name: 'Startup Strategist',
    category: 'Strategy & Growth',
    description: 'Advises founders on value proposition design, go-to-market strategies, and moat defensibility.',
    instructions: `You are a seasoned Y-Combinator style Startup Mentor.
Rules:
• Stress-test product-market fit, CAC/LTV unit economics, and distribution channels.
• Identify acute customer pain points and unfair advantages.
• Provide actionable, phased advice tailored for lean startup execution.`,
    preferredModel: 'gemini',
    tools: ['web_search', 'web_fetch', 'project_knowledge'],
    autonomy: 'auto',
    language: 'hi,en',
    outputStyle: 'detailed'
  },
  {
    id: 'template_tech_architect',
    name: 'Technical Architect',
    category: 'Engineering & Systems',
    description: 'Designs scalable cloud architectures, database schemas, and microservice/API patterns.',
    instructions: `You are a Principal Cloud Solutions Architect.
Rules:
• Design robust system architectures, data models, and API schemas.
• Evaluate throughput, caching, latency, security, and infrastructure costs.
• Provide concrete SQL/Prisma schemas and TypeScript interface definitions.`,
    preferredModel: 'openai',
    tools: ['project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'structured'
  },
  {
    id: 'template_coding',
    name: 'Coding Agent',
    category: 'Engineering & Systems',
    description: 'Writes, reviews, and refactors production-grade code, unit tests, and integrations.',
    instructions: `You are an elite Full-Stack Software Engineer.
Rules:
• Write clean, idiomatic, typed, and well-tested code.
• Include error handling, defensive guards, and modular architecture.
• Focus on implementation correctness and minimal technical debt.`,
    preferredModel: 'openai',
    tools: ['project_knowledge'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'concise'
  },
  {
    id: 'template_data_analyst',
    name: 'Data Analyst',
    category: 'Data & Metrics',
    description: 'Formulates analytical SQL queries, cohort models, and data-driven growth insights.',
    instructions: `You are a Chief Analytics Officer.
Rules:
• Formulate data models, retention cohorts, and metric trees.
• Suggest tracking events, funnel telemetry, and anomaly detection strategies.`,
    preferredModel: 'gemini',
    tools: ['project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'structured'
  },
  {
    id: 'template_marketing',
    name: 'Marketing & GTM Agent',
    category: 'Marketing & Copy',
    description: 'Creates positioning frameworks, landing page copy, and multi-channel acquisition campaigns.',
    instructions: `You are a Head of Growth & Marketing.
Rules:
• Craft compelling positioning hooks, clear value props, and SEO content clusters.
• Define conversion funnels, onboarding sequences, and viral referral loops.`,
    preferredModel: 'gemini',
    tools: ['web_search', 'project_knowledge'],
    autonomy: 'auto',
    language: 'hi,en',
    outputStyle: 'detailed'
  },
  {
    id: 'template_study',
    name: 'Study & Learning Agent',
    category: 'Education & Knowledge',
    description: 'Breaks down complex academic and technical topics into intuitive, first-principles explanations.',
    instructions: `You are an intuitive Socratic Educator.
Rules:
• Explain concepts using first-principles reasoning and relatable real-world analogies.
• Support multilingual code-switching between Hindi, English, and regional terminology.
• Test understanding with practice questions and progressive depth.`,
    preferredModel: 'sarvam',
    tools: ['project_knowledge'],
    autonomy: 'auto',
    language: 'hi,en',
    outputStyle: 'detailed'
  },
  {
    id: 'template_investor',
    name: 'Investor Pitch Agent',
    category: 'Fundraising & Finance',
    description: 'Structures investor pitch decks, valuation arguments, and venture fundraising narratives.',
    instructions: `You are a Venture Partner & Pitch Coach.
Rules:
• Construct 10-slide venture pitch deck structures.
• Highlight market size (TAM/SAM/SOM), defensible moat, and scalable unit economics.
• Prepare founders for difficult diligence questions and investor objections.`,
    preferredModel: 'gemini',
    tools: ['web_search', 'web_fetch', 'project_knowledge', 'documents'],
    autonomy: 'auto',
    language: 'en',
    outputStyle: 'structured'
  }
];

// GET /api/agents/templates
router.get('/templates', (req, res) => {
  res.json(AGENT_TEMPLATES);
});

// GET /api/agents/custom - List user's custom agents
router.get('/custom', requireAuth, async (req, res) => {
  try {
    const agents = await prisma.customAgent.findMany({
      where: { userId: req.authUser.id },
      orderBy: { updatedAt: 'desc' }
    });

    const parsed = agents.map(a => {
      let toolsArray = [];
      try { toolsArray = JSON.parse(a.tools || '[]'); } catch { toolsArray = []; }
      return {
        ...a,
        tools: toolsArray
      };
    });

    res.json(parsed);
  } catch (err) {
    console.error('[Custom Agent] List error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve custom agents', code: 'FETCH_FAILED' });
  }
});

// POST /api/agents/custom - Create a custom agent
router.post('/custom', requireAuth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      instructions, 
      preferredModel = 'auto', 
      tools = [], 
      autonomy = 'auto', 
      language = 'hi,en', 
      outputStyle = 'detailed' 
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Agent name is required', code: 'INVALID_INPUT' });
    }
    if (!instructions?.trim()) {
      return res.status(400).json({ error: 'Agent instructions are required', code: 'INVALID_INPUT' });
    }

    const toolsJson = JSON.stringify(Array.isArray(tools) ? tools : []);
    const langStr = Array.isArray(language) ? language.join(',') : (language || 'hi,en');

    const created = await prisma.customAgent.create({
      data: {
        userId: req.authUser.id,
        name: name.trim(),
        description: description?.trim() || null,
        instructions: instructions.trim(),
        preferredModel: preferredModel || 'auto',
        tools: toolsJson,
        autonomy: autonomy || 'auto',
        language: langStr,
        outputStyle: outputStyle || 'detailed'
      }
    });

    res.status(201).json({
      ...created,
      tools: Array.isArray(tools) ? tools : []
    });
  } catch (err) {
    console.error('[Custom Agent] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create custom agent', code: 'CREATE_FAILED' });
  }
});

// PUT /api/agents/custom/:id - Update custom agent
router.put('/custom/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      instructions, 
      preferredModel, 
      tools, 
      autonomy, 
      language, 
      outputStyle 
    } = req.body;

    const existing = await prisma.customAgent.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.authUser.id) {
      return res.status(404).json({ error: 'Custom agent not found', code: 'NOT_FOUND' });
    }

    const updated = await prisma.customAgent.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description?.trim() : undefined,
        instructions: instructions !== undefined ? instructions.trim() : undefined,
        preferredModel: preferredModel !== undefined ? preferredModel : undefined,
        tools: tools !== undefined ? JSON.stringify(Array.isArray(tools) ? tools : []) : undefined,
        autonomy: autonomy !== undefined ? autonomy : undefined,
        language: language !== undefined ? language : undefined,
        outputStyle: outputStyle !== undefined ? outputStyle : undefined
      }
    });

    let toolsArray = [];
    try { toolsArray = JSON.parse(updated.tools || '[]'); } catch { toolsArray = []; }

    res.json({
      success: true,
      agent: {
        ...updated,
        tools: toolsArray
      }
    });
  } catch (err) {
    console.error('[Custom Agent] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update custom agent', code: 'UPDATE_FAILED' });
  }
});

// DELETE /api/agents/custom/:id - Delete custom agent
router.delete('/custom/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customAgent.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.authUser.id) {
      return res.status(404).json({ error: 'Custom agent not found', code: 'NOT_FOUND' });
    }

    await prisma.customAgent.delete({ where: { id } });
    res.json({ success: true, message: 'Custom agent deleted successfully' });
  } catch (err) {
    console.error('[Custom Agent] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete custom agent', code: 'DELETE_FAILED' });
  }
});

export default router;
