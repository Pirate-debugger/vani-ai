import prisma from '../lib/prisma.js';
import { getAIResponse } from './llm.js';

const AGENT_SYSTEM_PROMPTS = {
  idea_discovery: `You are an Idea Discovery Agent. Your goal is to refine the user's startup concept and identify the problem statement and target audience.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Idea Overview, Problem Statement, Target Audience, Core Value Proposition, Clarifying Questions for User"
}`,
  brd: `You are a Senior Business Analyst Agent. Your goal is to generate a comprehensive Business Requirement Document (BRD). 
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Executive Summary, Problem Statement, Goals, Stakeholders, Functional Requirements, Non-Functional Requirements, User Personas, Risks, KPIs, Future Scope"
}`,
  prd: `You are a Senior Product Manager Agent. Your goal is to generate a Product Requirement Document (PRD) from a BRD or Idea. Use MoSCoW, RICE, or Kano frameworks where applicable.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Product Vision, Product Strategy, Feature Prioritization, MVP Scope, Acceptance Criteria, Success Metrics"
}`,
  startup: `You are a Startup Consultant Agent. Generate a comprehensive Startup Plan.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Business Plan, Lean Canvas, Business Model Canvas, Pitch Deck Structure, Revenue Streams, Pricing Strategy, Go-To-Market Plan, Funding Plan"
}`,
  roadmap: `You are a Product Roadmap Agent. Generate a phased product roadmap.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Phase 1 (MVP), Phase 2 (Beta), Phase 3 (Launch), Phase 4 (Scale), with Timelines and Milestones"
}`,
  user_story: `You are an Agile Product Owner Agent. Generate Epics and User Stories.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing Epics, Features, and User Stories (As a [User], I want to [Action] so that [Benefit])"
}`,
  idea_validation: `You are an Idea Validation Agent. Analyze market demand and risks.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Market Demand, Competitors, Feasibility, Risks, Validation Score, Success Probability"
}`,
  market_research: `You are a Market Research Agent. Analyze the market opportunity.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Market Opportunity, Industry Trends, Competitor Analysis, SWOT Analysis, Target Demographics"
}`,
  technical_architect: `You are a Technical Architect Agent. Design the system architecture.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: System Design, Frontend Architecture, Backend Architecture, Database Design, API Design, Scalability Plan"
}`,
  ux_designer: `You are a UX Designer Agent. Design the user experience.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: User Personas, User Journey Map, Core App Screens, UI/UX Suggestions, Wireframe Structure"
}`,
  funding: `You are a Funding Agent. Prepare the startup for investment.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Funding Readiness, Investor Pitch, TAM SAM SOM Analysis, Valuation Expectations, Use of Funds"
}`,
  student: `You are a Student Mentor Agent. Generate academic documentation for the project.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Project Report Outline, SRS (Software Requirements Specification), BRD, DFD Description, ERD Description, Expected Viva Questions, PPT Content Outline"
}`,
  investor: `You are an Investor Pitch Agent. Generate an investor package.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Executive Summary, Business Plan, Market Opportunity, TAM SAM SOM, Revenue Forecast"
}`,
  hackathon: `You are a Hackathon Pitch Agent. Generate a Hackathon Package.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Problem Statement, Solution, Innovation, Architecture Diagram Text, Tech Stack, Future Scope, Demo Script, Judge Q&A"
}
`};

export const identifyAgentIntent = async (userPrompt, apiKeys) => {
  const routerPrompt = `You are the AI Routing Engine for Bharat Startup Copilot.
Your job is to read the user's prompt and determine which of the following AI Agents is best suited to handle the request.
Available Agents:
- idea_discovery: Refine startup concept, identify problem statement.
- brd: Create Business Requirement Document.
- prd: Create Product Requirement Document.
- startup: Create Startup Plan, Lean Canvas, Business Model.
- roadmap: Create phased product roadmap.
- user_story: Generate Epics and User stories.
- idea_validation: Analyze market demand and risks.
- market_research: Competitor analysis, SWOT, industry trends.
- technical_architect: System design, DB schema, architecture.
- ux_designer: User personas, journey, UI suggestions.
- funding: Investor pitch, funding readiness.
- student: Project report, academic docs.
- hackathon: Hackathon pitch package.
- general: Any other general chat query.

User Prompt: "${userPrompt}"

Respond ONLY with the exact string ID of the agent (e.g. "brd" or "technical_architect" or "general"). Do not include any other text.`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt: routerPrompt,
      langCode: 'en-US',
      personality: 'respectful',
      ...apiKeys
    });
    
    const intent = response.response.trim().toLowerCase();
    // Validate that the intent is one of our agents
    if (AGENT_SYSTEM_PROMPTS[intent] || intent === 'general') {
      return intent;
    }
    return 'general';
  } catch (error) {
    console.error('Agent Router Error:', error);
    return 'general';
  }
};

export const runAgentWorkflow = async (projectId, agentType, userPrompt, contextMessages, apiKeys) => {
  // If not a document-generating agent, just run standard chat
  if (!AGENT_SYSTEM_PROMPTS[agentType]) {
    return getAIResponse({
      messages: contextMessages,
      prompt: userPrompt,
      langCode: 'en-IN',
      personality: agentType, // pass as persona
      ...apiKeys
    });
  }

  // Inject strict JSON instruction
  const agentPrompt = AGENT_SYSTEM_PROMPTS[agentType];
  const enhancedPrompt = `${agentPrompt}\n\nUser Request: ${userPrompt}\n\nIMPORTANT: Return ONLY valid JSON, no markdown formatting blocks around it.`;

  const response = await getAIResponse({
    messages: contextMessages,
    prompt: enhancedPrompt,
    langCode: 'en-IN', 
    personality: 'document_agent', // A new generic persona we'll add to llm.js
    ...apiKeys
  });

  try {
    // Attempt to parse JSON
    let contentStr = response.response;
    if (contentStr.startsWith('\`\`\`json')) {
      contentStr = contentStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
    }
    const parsed = JSON.parse(contentStr.trim());

    if (projectId) {
      // Save document to database
      const document = await prisma.document.create({
        data: {
          projectId,
          type: agentType,
          title: parsed.title || `${agentType.toUpperCase()} Document`,
          content: parsed.content || JSON.stringify(parsed)
        }
      });

      // Save initial version
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          content: document.content,
          versionName: 'v1.0'
        }
      });

      return {
        response: `Successfully generated ${agentType.toUpperCase()}: ${document.title}. You can view it in the project dashboard.`,
        documentId: document.id,
        model: response.model
      };
    }

    return {
      response: `Generated successfully, but no project ID was provided to save it. Preview: \n\n${parsed.content}`,
      model: response.model
    };

  } catch (error) {
    console.error('Agent JSON Parsing Error:', error, 'Raw Output:', response.response);
    return {
      response: "The agent failed to generate a strictly formatted document. Please try again.",
      raw: response.response,
      error: error.message
    };
  }
};
