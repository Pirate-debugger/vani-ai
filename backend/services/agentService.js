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
}`,
  research: `You are a Senior AI Research & Intelligence Agent powered by Gemini. Perform deep research, competitor intelligence, and live web market analysis.
Return the output STRICTLY as a JSON object with the following schema:
{
  "title": "String",
  "content": "Markdown string containing: Executive Summary, Market Statistics, Competitor Analysis, Key Research Findings, Strategic Recommendations, Sources & Citations"
}`
};

export const extractTasksFromDocument = async (documentContent, apiKeys) => {
  const prompt = `You are a Delivery Manager Agent. Read the following Business Requirement Document and extract 5-10 concrete action items needed to build it. Return STRICTLY a JSON array, no markdown fences, no extra text:
[{"title": "string", "description": "string", "suggestedAssignee": "string or null", "priority": "high|medium|low"}]

Document Content:
${documentContent}`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt,
      langCode: 'en-US',
      personality: 'document_agent',
      provider: apiKeys.geminiKey ? 'gemini' : undefined,
      ...apiKeys
    });

    let contentStr = response.response.trim();
    if (contentStr.startsWith('```json')) {
      contentStr = contentStr.replace(/^```json/, '').replace(/```$/, '');
    } else if (contentStr.startsWith('```')) {
      contentStr = contentStr.replace(/^```/, '').replace(/```$/, '');
    }
    const parsed = JSON.parse(contentStr.trim());
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error('Error extracting tasks from document:', error);
    return [];
  }
};

export const parseTaskCommand = async (userPrompt, existingTasks = [], apiKeys) => {
  const formattedTasksList = existingTasks.map((t, idx) => 
    `Task ${idx + 1}: ID="${t.id}", Title="${t.title}", Status="${t.status}", Assignee="${t.assignee || 'Unassigned'}"`
  ).join('\n');

  const prompt = `You are a Task Management Assistant.
Existing tasks in project:
${formattedTasksList || '(No existing tasks)'}

User spoken command: "${userPrompt}"

Analyze the user's spoken command and map it to an action for one of the existing tasks (or list/query them).
Return STRICTLY a JSON object with this exact shape, no markdown fences, no extra text:
{
  "action": "assign" | "update_status" | "list" | "unknown",
  "taskId": "string or null (the exact ID of the matched task from the list)",
  "assignee": "string or null",
  "status": "pending" | "in_progress" | "done" | null
}`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt,
      langCode: 'en-US',
      personality: 'respectful',
      provider: apiKeys.geminiKey ? 'gemini' : undefined,
      ...apiKeys
    });

    let contentStr = response.response.trim();
    if (contentStr.startsWith('```json')) {
      contentStr = contentStr.replace(/^```json/, '').replace(/```$/, '');
    } else if (contentStr.startsWith('```')) {
      contentStr = contentStr.replace(/^```/, '').replace(/```$/, '');
    }
    const parsed = JSON.parse(contentStr.trim());
    return {
      action: parsed.action || 'unknown',
      taskId: parsed.taskId || null,
      assignee: parsed.assignee || null,
      status: parsed.status || null
    };
  } catch (error) {
    console.error('Error parsing task command:', error);
    return { action: 'unknown', taskId: null, assignee: null, status: null };
  }
};

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
- research: Deep research, web search, market statistics, live search intelligence.
- technical_architect: System design, DB schema, architecture.
- ux_designer: User personas, journey, UI suggestions.
- funding: Investor pitch, funding readiness.
- student: Project report, academic docs.
- hackathon: Hackathon pitch package.
- task_command: Assign, reassign, mark status, or list existing tasks/action items.
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
    if (AGENT_SYSTEM_PROMPTS[intent] || intent === 'general' || intent === 'task_command') {
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

  const isResearch = agentType === 'research' || agentType === 'market_research';

  const response = await getAIResponse({
    messages: contextMessages,
    prompt: enhancedPrompt,
    langCode: 'en-IN', 
    personality: 'document_agent',
    enableSearch: isResearch,
    provider: (isResearch || apiKeys.geminiKey) ? 'gemini' : undefined,
    ...apiKeys
  });


  try {
    // Attempt to parse JSON
    let contentStr = response.response;
    if (contentStr.startsWith('```json')) {
      contentStr = contentStr.replace(/^```json/, '').replace(/```$/, '');
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

      let createdTasks = [];
      if (agentType === 'brd') {
        try {
          const extractedTasks = await extractTasksFromDocument(document.content, apiKeys);
          if (extractedTasks && extractedTasks.length > 0) {
            await prisma.task.createMany({
              data: extractedTasks.map(t => ({
                documentId: document.id,
                projectId,
                title: t.title || 'Untitled Action Item',
                description: t.description || null,
                assignee: t.suggestedAssignee || null,
                priority: t.priority || 'medium',
                source: 'voice_brd_extraction'
              }))
            });

            createdTasks = await prisma.task.findMany({
              where: { documentId: document.id },
              orderBy: { createdAt: 'asc' }
            });
          }
        } catch (taskErr) {
          console.error('Task extraction error (non-fatal):', taskErr);
        }
      }

      return {
        response: `Successfully generated ${agentType.toUpperCase()}: ${document.title}. You can view it in the project dashboard.`,
        documentId: document.id,
        model: response.model,
        tasks: createdTasks
      };
    }

    return {
      response: `Generated successfully, but no project ID was provided to save it. Preview: \n\n${parsed.content}`,
      model: response.model,
      tasks: []
    };

  } catch (error) {
    console.error('Agent JSON Parsing Error:', error, 'Raw Output:', response.response);
    return {
      response: "The agent failed to generate a strictly formatted document. Please try again.",
      raw: response.response,
      error: error.message,
      tasks: []
    };
  }
};

