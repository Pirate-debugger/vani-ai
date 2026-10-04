import { BRDSchema, PRDSchema, TaskListSchema, ResearchResultSchema } from '../lib/schemas.js';

export const AGENT_REGISTRY = {
  brd: {
    id: 'brd',
    name: 'BRD Generation Agent',
    description: 'Generates comprehensive 29-section Enterprise Business Requirements Documents with grounded live research.',
    capabilities: ['reasoning', 'document', 'structured_output', 'research'],
    requiredCapabilities: ['reasoning', 'document', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'structured_document',
    outputSchema: BRDSchema
  },
  prd: {
    id: 'prd',
    name: 'PRD Generation Agent',
    description: 'Generates structured Product Requirements Documents with technical specifications and user journeys.',
    capabilities: ['reasoning', 'document', 'structured_output'],
    requiredCapabilities: ['reasoning', 'document', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'structured_document',
    outputSchema: PRDSchema
  },
  idea_discovery: {
    id: 'idea_discovery',
    name: 'Startup Idea Discovery Agent',
    description: 'Explores, refines, and identifies problem spaces and customer pain points.',
    capabilities: ['reasoning', 'chat'],
    requiredCapabilities: ['reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  idea_validation: {
    id: 'idea_validation',
    name: 'Idea Validation Agent',
    description: 'Rigorously stress-tests business models, unit economics, and market demand.',
    capabilities: ['reasoning', 'research'],
    requiredCapabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'plan'
  },
  market_research: {
    id: 'market_research',
    name: 'Market Research Agent',
    description: 'Synthesizes market data, competitor pricing, TAM/SAM/SOM, and industry trends via TinyFish.',
    capabilities: ['research', 'web_search', 'web_fetch'],
    requiredCapabilities: ['research', 'web_search', 'web_fetch'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'research_report',
    outputSchema: ResearchResultSchema
  },
  research: {
    id: 'research',
    name: 'Deep Web Research Agent',
    description: 'Performs multi-step live web search and deep page extractions.',
    capabilities: ['web_search', 'web_fetch', 'web_agent', 'research'],
    requiredCapabilities: ['web_search', 'web_fetch', 'web_agent'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch', 'tinyfish.agent'],
    outputType: 'research_report',
    outputSchema: ResearchResultSchema
  },
  startup: {
    id: 'startup',
    name: 'Startup Strategy Copilot',
    description: 'Strategic advisor for Indian startups navigating scale, GTM, and regulatory factors.',
    capabilities: ['reasoning', 'chat', 'document'],
    requiredCapabilities: ['reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  roadmap: {
    id: 'roadmap',
    name: 'Product Roadmap Agent',
    description: 'Constructs phased milestone plans across MVP, V1, and scale horizons.',
    capabilities: ['reasoning', 'document'],
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true,
    tools: [],
    outputType: 'plan'
  },
  user_story: {
    id: 'user_story',
    name: 'Agile User Story Agent',
    description: 'Breaks down product scopes into Gherkin acceptance criteria and user stories.',
    capabilities: ['reasoning', 'structured_output'],
    requiredCapabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: false,
    supportsTools: true,
    tools: [],
    outputType: 'plan'
  },
  technical_architect: {
    id: 'technical_architect',
    name: 'Technical Architecture Agent',
    description: 'Designs cloud infrastructure, API contracts, database schemas, and microservice blueprints.',
    capabilities: ['coding', 'reasoning', 'document'],
    requiredCapabilities: ['coding', 'reasoning'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'structured_document'
  },
  build: {
    id: 'build',
    name: 'Build MVP Agent',
    description: 'Converts goals into an executable project plan: Product requirements, Database, APIs, UI, Architecture, Milestones, Tasks, and Timeline.',
    capabilities: ['reasoning', 'coding', 'document', 'structured_output'],
    requiredCapabilities: ['reasoning', 'coding', 'document'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'structured_document'
  },
  plan: {
    id: 'plan',
    name: 'Plan Mode Agent',
    description: 'Creates structured step-by-step action plans before execution with interactive approval.',
    capabilities: ['reasoning', 'chat', 'structured_output'],
    requiredCapabilities: ['reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  ux_designer: {
    id: 'ux_designer',
    name: 'UX/UI Wireframe Agent',
    description: 'Plans intuitive user flows, interaction states, and information hierarchy.',
    capabilities: ['reasoning', 'document'],
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true,
    tools: [],
    outputType: 'plan'
  },
  funding: {
    id: 'funding',
    name: 'Fundraising & Grants Agent',
    description: 'Identifies government schemes (Startup India, SISFS, DST), venture funds, and pitch positioning.',
    capabilities: ['reasoning', 'research'],
    requiredCapabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  student: {
    id: 'student',
    name: 'Student Project Mentor',
    description: 'Guides college academic capstone, synopsis, and dissertation documentation.',
    capabilities: ['reasoning', 'document'],
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  investor: {
    id: 'investor',
    name: 'Investor Memo & Pitch Agent',
    description: 'Constructs investment teasers, pitch decks, and financial model assumptions.',
    capabilities: ['reasoning', 'document'],
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  hackathon: {
    id: 'hackathon',
    name: 'Hackathon Sprint Agent',
    description: 'Accelerates 24-48hr project definitions, elevator pitches, and demo scripts.',
    capabilities: ['reasoning', 'fast'],
    requiredCapabilities: ['reasoning', 'fast'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true,
    tools: [],
    outputType: 'plan'
  },
  task_command: {
    id: 'task_command',
    name: 'Task Management Agent',
    description: 'Voice and text controller for project backlog queries, task assignment, and status updates.',
    capabilities: ['reasoning', 'structured_output'],
    requiredCapabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true,
    outputSchema: TaskListSchema,
    tools: [],
    outputType: 'task_list'
  },
  general: {
    id: 'general',
    name: 'General Business Assistant',
    description: 'Multilingual conversational assistant supporting Indian business contexts.',
    capabilities: ['chat', 'indian_languages'],
    requiredCapabilities: ['chat', 'indian_languages'],
    preferredProvider: 'sarvam',
    fallbackProviders: ['gemini', 'openai'],
    supportsWebResearch: false,
    supportsTools: false,
    tools: [],
    outputType: 'text'
  }
};

// Aliases for canonical naming and routing
export const CANONICAL_ALIASES = {
  auto: {
    id: 'auto',
    name: 'Auto Agent',
    description: 'Infers intent dynamically and selects the optimal agent and capabilities.',
    capabilities: ['intent_routing', 'reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true,
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'text'
  },
  technical: AGENT_REGISTRY.technical_architect,
  task: AGENT_REGISTRY.task_command,
  product: AGENT_REGISTRY.idea_discovery,
  chat: AGENT_REGISTRY.general
};

export const ALL_AGENTS = {
  ...AGENT_REGISTRY,
  ...CANONICAL_ALIASES
};

export const CANONICAL_AGENTS = AGENT_REGISTRY;

export function getAgent(agentId) {
  if (!agentId || agentId === 'auto') return CANONICAL_ALIASES.auto;
  return ALL_AGENTS[agentId] || AGENT_REGISTRY.general;
}

export function listAgents() {
  return Object.values(AGENT_REGISTRY);
}

export default {
  AGENT_REGISTRY,
  ALL_AGENTS,
  CANONICAL_ALIASES,
  getAgent,
  listAgents
};
