export const CANONICAL_AGENTS = [
  {
    id: 'auto',
    name: 'Auto Agent',
    icon: '✨',
    description: 'Infers intent dynamically and selects the optimal agent and capabilities.',
    capabilities: ['intent_routing', 'reasoning', 'chat'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'text'
  },
  {
    id: 'brd',
    name: 'BRD Agent',
    icon: '📋',
    description: 'Generates comprehensive 29-section Enterprise Business Requirements Documents with grounded live research.',
    capabilities: ['reasoning', 'document', 'structured_output', 'research'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'structured_document'
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: '🌐',
    description: 'Autonomous multi-step live web search, competitor analysis, and page evidence extraction.',
    capabilities: ['web_search', 'web_fetch', 'web_agent', 'research'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search', 'tinyfish.fetch', 'tinyfish.agent'],
    outputType: 'research_report'
  },
  {
    id: 'prd',
    name: 'PRD Agent',
    icon: '📑',
    description: 'Creates structured Product Requirements Documents with technical specs, MoSCoW, and user journeys.',
    capabilities: ['reasoning', 'document', 'structured_output'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search'],
    outputType: 'structured_document'
  },
  {
    id: 'product',
    name: 'Product Agent',
    icon: '💡',
    description: 'Product strategy, customer discovery, value proposition, and feature prioritization.',
    capabilities: ['reasoning', 'chat', 'document'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  {
    id: 'technical',
    name: 'Technical Agent',
    icon: '⚙',
    description: 'Designs cloud infrastructure, API contracts, database schemas, and microservice blueprints.',
    capabilities: ['coding', 'reasoning', 'document'],
    preferredProvider: 'openai',
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'structured_document'
  },
  {
    id: 'startup',
    name: 'Startup Agent',
    icon: '🚀',
    description: 'Strategic advisor for startups: Lean canvas, GTM strategy, unit economics, and scaling.',
    capabilities: ['reasoning', 'chat', 'document'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  {
    id: 'task',
    name: 'Task Agent',
    icon: '✓',
    description: 'Backlog management, task extraction from requirements, and project execution tracking.',
    capabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'gemini',
    tools: [],
    outputType: 'task_list'
  },
  {
    id: 'roadmap',
    name: 'Roadmap Agent',
    icon: '🗺',
    description: 'Constructs phased milestone plans across MVP, V1, and scale horizons.',
    capabilities: ['reasoning', 'document'],
    preferredProvider: 'gemini',
    tools: [],
    outputType: 'plan'
  },
  {
    id: 'user_story',
    name: 'User Story Agent',
    icon: '📝',
    description: 'Deconstructs product scopes into Gherkin acceptance criteria and agile user stories.',
    capabilities: ['reasoning', 'structured_output'],
    preferredProvider: 'openai',
    tools: [],
    outputType: 'plan'
  },
  {
    id: 'idea_validation',
    name: 'Idea Validation Agent',
    icon: '🔍',
    description: 'Stress-tests business models, market demand, competition, and feasibility risks.',
    capabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search', 'tinyfish.fetch'],
    outputType: 'plan'
  },
  {
    id: 'funding',
    name: 'Funding Agent',
    icon: '💰',
    description: 'Identifies government schemes (Startup India, SISFS, DST), venture funds, and pitch positioning.',
    capabilities: ['reasoning', 'research'],
    preferredProvider: 'gemini',
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  {
    id: 'investor',
    name: 'Investor Agent',
    icon: '📊',
    description: 'Constructs investment teasers, pitch decks, and financial model assumptions.',
    capabilities: ['reasoning', 'document'],
    preferredProvider: 'openai',
    tools: ['tinyfish.search'],
    outputType: 'plan'
  },
  {
    id: 'hackathon',
    name: 'Hackathon Agent',
    icon: '⚡',
    description: 'Accelerates 24-48hr project definitions, elevator pitches, and demo scripts.',
    capabilities: ['reasoning', 'fast'],
    preferredProvider: 'gemini',
    tools: [],
    outputType: 'plan'
  },
  {
    id: 'general',
    name: 'General Assistant',
    icon: '✦',
    description: 'Multilingual conversational assistant supporting Indian business contexts.',
    capabilities: ['chat', 'indian_languages'],
    preferredProvider: 'sarvam',
    tools: [],
    outputType: 'text'
  }
];

export const AGENT_MAP = CANONICAL_AGENTS.reduce((acc, a) => {
  acc[a.id] = a;
  return acc;
}, {});

// Aliases
AGENT_MAP['technical_architect'] = AGENT_MAP['technical'];
AGENT_MAP['task_command'] = AGENT_MAP['task'];
AGENT_MAP['market_research'] = AGENT_MAP['research'];
AGENT_MAP['idea_discovery'] = AGENT_MAP['product'];
AGENT_MAP['ux_designer'] = AGENT_MAP['product'];
AGENT_MAP['student'] = AGENT_MAP['general'];

export function getAgentDef(id) {
  if (!id || id === 'auto') return AGENT_MAP.auto;
  return AGENT_MAP[id] || AGENT_MAP.general;
}

export default CANONICAL_AGENTS;
