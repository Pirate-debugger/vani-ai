import { BRDSchema, PRDSchema, TaskListSchema, ResearchResultSchema } from '../lib/schemas.js';

export const AGENT_REGISTRY = {
  brd: {
    id: 'brd',
    name: 'BRD Generation Agent',
    description: 'Generates comprehensive 29-section Enterprise Business Requirements Documents with grounded live research.',
    requiredCapabilities: ['reasoning', 'document', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    outputSchema: BRDSchema
  },
  prd: {
    id: 'prd',
    name: 'PRD Generation Agent',
    description: 'Generates structured Product Requirements Documents with technical specifications and user journeys.',
    requiredCapabilities: ['reasoning', 'document', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    outputSchema: PRDSchema
  },
  idea_discovery: {
    id: 'idea_discovery',
    name: 'Startup Idea Discovery Agent',
    description: 'Explores, refines, and identifies problem spaces and customer pain points.',
    requiredCapabilities: ['reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true
  },
  idea_validation: {
    id: 'idea_validation',
    name: 'Idea Validation Agent',
    description: 'Rigorously stress-tests business models, unit economics, and market demand.',
    requiredCapabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true
  },
  market_research: {
    id: 'market_research',
    name: 'Market Research Agent',
    description: 'Synthesizes market data, competitor pricing, TAM/SAM/SOM, and industry trends via TinyFish.',
    requiredCapabilities: ['research', 'web_search', 'web_fetch'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    outputSchema: ResearchResultSchema
  },
  research: {
    id: 'research',
    name: 'Deep Web Research Agent',
    description: 'Performs multi-step live web search and deep page extractions.',
    requiredCapabilities: ['web_search', 'web_fetch', 'web_agent'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true,
    outputSchema: ResearchResultSchema
  },
  startup: {
    id: 'startup',
    name: 'Startup Strategy Copilot',
    description: 'Strategic advisor for Indian startups navigating scale, GTM, and regulatory factors.',
    requiredCapabilities: ['reasoning', 'chat'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true
  },
  roadmap: {
    id: 'roadmap',
    name: 'Product Roadmap Agent',
    description: 'Constructs phased milestone plans across MVP, V1, and scale horizons.',
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true
  },
  user_story: {
    id: 'user_story',
    name: 'Agile User Story Agent',
    description: 'Breaks down product scopes into Gherkin acceptance criteria and user stories.',
    requiredCapabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: false,
    supportsTools: true
  },
  technical_architect: {
    id: 'technical_architect',
    name: 'Technical Architecture Agent',
    description: 'Designs cloud infrastructure, API contracts, database schemas, and microservice blueprints.',
    requiredCapabilities: ['coding', 'reasoning'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: true,
    supportsTools: true
  },
  ux_designer: {
    id: 'ux_designer',
    name: 'UX/UI Wireframe Agent',
    description: 'Plans intuitive user flows, interaction states, and information hierarchy.',
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true
  },
  funding: {
    id: 'funding',
    name: 'Fundraising & Grants Agent',
    description: 'Identifies government schemes (Startup India, SISFS, DST), venture funds, and pitch positioning.',
    requiredCapabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: true,
    supportsTools: true
  },
  student: {
    id: 'student',
    name: 'Student Project Mentor',
    description: 'Guides college academic capstone, synopsis, and dissertation documentation.',
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai', 'sarvam'],
    supportsWebResearch: true,
    supportsTools: true
  },
  investor: {
    id: 'investor',
    name: 'Investor Memo & Pitch Agent',
    description: 'Constructs investment teasers, pitch decks, and financial model assumptions.',
    requiredCapabilities: ['reasoning', 'document'],
    preferredProvider: 'openai',
    fallbackProviders: ['gemini'],
    supportsWebResearch: true,
    supportsTools: true
  },
  hackathon: {
    id: 'hackathon',
    name: 'Hackathon Sprint Agent',
    description: 'Accelerates 24-48hr project definitions, elevator pitches, and demo scripts.',
    requiredCapabilities: ['reasoning', 'fast'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true
  },
  task_command: {
    id: 'task_command',
    name: 'Task Management Agent',
    description: 'Voice and text controller for project backlog queries, task assignment, and status updates.',
    requiredCapabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'gemini',
    fallbackProviders: ['openai'],
    supportsWebResearch: false,
    supportsTools: true,
    outputSchema: TaskListSchema
  },
  general: {
    id: 'general',
    name: 'General Business Assistant',
    description: 'Multilingual conversational assistant supporting Indian business contexts.',
    requiredCapabilities: ['chat', 'indian_languages'],
    preferredProvider: 'sarvam',
    fallbackProviders: ['gemini', 'openai'],
    supportsWebResearch: false,
    supportsTools: false
  }
};

export function getAgent(agentId) {
  return AGENT_REGISTRY[agentId] || AGENT_REGISTRY.general;
}

export function listAgents() {
  return Object.values(AGENT_REGISTRY);
}

export default {
  AGENT_REGISTRY,
  getAgent,
  listAgents
};
