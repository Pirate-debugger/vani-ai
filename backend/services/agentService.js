import prisma from '../lib/prisma.js';
import { getAIResponse } from './llm.js';
import { parseStructuredJSON, validateAndNormalizeBRD, validateAndNormalizeTasks } from '../lib/jsonParser.js';
import { researchForBRD, shouldUseLiveResearch } from './tinyfish.js';

export const BRD_SYSTEM_PROMPT = `You are a Principal Business Analyst, Product Manager, and Requirements Engineer.
Your objective is to generate an exhaustive, enterprise-grade Business Requirements Document (BRD).

You MUST distinguish clearly between:
- USER FACTS (what the user explicitly stated)
- AI INFERENCES (logical deductions and best-practice proposals)
- LIVE WEB RESEARCH (market data, competitors, benchmarks if provided)
- OPEN QUESTIONS (critical unknowns requiring stakeholder clarification)

You MUST generate the document containing all 27 structured sections below in clear markdown:
# Business Requirements Document: [Project Title]

## 1. Executive Summary
## 2. Business Background
## 3. Problem Statement
## 4. Business Objectives
## 5. Goals
## 6. Success Criteria
## 7. Stakeholders
## 8. Target Users
## 9. User Personas
## 10. Current State
## 11. Proposed Solution
## 12. Functional Requirements
Format each functional requirement systematically:
- **FR-001**: [Requirement Name]
  - **Description**: [Detailed description]
  - **Actor**: [User/Admin/System]
  - **Priority**: [High/Medium/Low]
  - **Expected Outcome**: [Measurable outcome]
(Provide at least FR-001 through FR-006)

## 13. Non-Functional Requirements
Include NFR-001 onwards covering: Performance, Security, Scalability, Availability, Usability, Accessibility, Maintainability, and Compliance.
- **NFR-001**: [Security & Privacy]
- **NFR-002**: [Performance & Latency]
- **NFR-003**: [Scalability & Concurrency]
- **NFR-004**: [Availability & Reliability]

## 14. Business Rules
## 15. User Workflows
## 16. Data Requirements
## 17. Integration Requirements
## 18. Dependencies
## 19. Assumptions
## 20. Constraints
## 21. Risks and Mitigation
## 22. KPIs
## 23. Competitor/Market Analysis
(If research is provided, ground analysis in those real findings. If no research is available, state current market context without fabricating specific URLs or numbers.)
## 24. Open Questions
## 25. MVP Scope
## 26. Future Scope
## 27. Implementation Priorities

RETURN YOUR OUTPUT STRICTLY AS A VALID JSON OBJECT WITH THIS EXACT SCHEMA (NO MARKDOWN CODE BLOCK OUTSIDE):
{
  "title": "Project Title BRD",
  "summary": "A concise 2-3 sentence executive summary of the project and its core requirements.",
  "content": "Complete 27-section Markdown string as specified above.",
  "metadata": {
    "researchUsed": true,
    "confidence": "high",
    "missingInformation": ["List of any key missing details"],
    "sources": [
      { "title": "Source Name", "url": "https://..." }
    ]
  }
}`;

const AGENT_SYSTEM_PROMPTS = {
  idea_discovery: `You are an Idea Discovery Agent. Your goal is to refine the user's startup concept and identify the problem statement and target audience.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Idea Overview, Problem Statement, Target Audience, Core Value Proposition, Clarifying Questions for User",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  brd: BRD_SYSTEM_PROMPT,
  prd: `You are a Senior Product Manager Agent. Your goal is to generate a Product Requirement Document (PRD) from a BRD or Idea. Use MoSCoW, RICE, or Kano frameworks where applicable.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Product Vision, Product Strategy, Feature Prioritization, MVP Scope, Acceptance Criteria, Success Metrics",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  startup: `You are a Startup Consultant Agent. Generate a comprehensive Startup Plan.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Business Plan, Lean Canvas, Business Model Canvas, Pitch Deck Structure, Revenue Streams, Pricing Strategy, Go-To-Market Plan, Funding Plan",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  roadmap: `You are a Product Roadmap Agent. Generate a phased product roadmap.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Phase 1 (MVP), Phase 2 (Beta), Phase 3 (Launch), Phase 4 (Scale), with Timelines and Milestones",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  user_story: `You are an Agile Product Owner Agent. Generate Epics and User Stories.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing Epics, Features, and User Stories (As a [User], I want to [Action] so that [Benefit])",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  idea_validation: `You are an Idea Validation Agent. Analyze market demand and risks.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Market Demand, Competitors, Feasibility, Risks, Validation Score, Success Probability",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  market_research: `You are a Market Research Agent. Analyze the market opportunity.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Market Opportunity, Industry Trends, Competitor Analysis, SWOT Analysis, Target Demographics",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  technical_architect: `You are a Technical Architect Agent. Design the system architecture.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: System Design, Frontend Architecture, Backend Architecture, Database Design, API Design, Scalability Plan",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  ux_designer: `You are a UX Designer Agent. Design the user experience.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: User Personas, User Journey Map, Core App Screens, UI/UX Suggestions, Wireframe Structure",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  funding: `You are a Funding Agent. Prepare the startup for investment.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Funding Readiness, Investor Pitch, TAM SAM SOM Analysis, Valuation Expectations, Use of Funds",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  student: `You are a Student Mentor Agent. Generate academic documentation for the project.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Project Report Outline, SRS (Software Requirements Specification), BRD, DFD Description, ERD Description, Expected Viva Questions, PPT Content Outline",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  investor: `You are an Investor Pitch Agent. Generate an investor package.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Executive Summary, Business Plan, Market Opportunity, TAM SAM SOM, Revenue Forecast",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  hackathon: `You are a Hackathon Pitch Agent. Generate a Hackathon Package.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Problem Statement, Solution, Innovation, Architecture Diagram Text, Tech Stack, Future Scope, Demo Script, Judge Q&A",
  "metadata": { "researchUsed": false, "confidence": "high", "missingInformation": [], "sources": [] }
}`,
  research: `You are a Senior AI Research & Intelligence Agent. Perform deep research, competitor intelligence, and market analysis.
Return the output STRICTLY as a JSON object with schema:
{
  "title": "String",
  "summary": "String",
  "content": "Markdown string containing: Executive Summary, Market Statistics, Competitor Analysis, Key Research Findings, Strategic Recommendations, Sources & Citations",
  "metadata": { "researchUsed": true, "confidence": "high", "missingInformation": [], "sources": [] }
}`
};

/**
 * Extracts 5-10 concrete, actionable tasks from document content.
 * Strictly validates and normalizes task priorities and titles.
 */
export const extractTasksFromDocument = async (documentContent, apiKeys) => {
  if (!documentContent || typeof documentContent !== 'string') return [];

  const prompt = `You are a Delivery Manager Agent. Read the following Business Requirement Document and extract 5-10 concrete, non-duplicate implementation tasks needed to build it.
Schema requirement - return STRICTLY a JSON array, no markdown fences:
[
  {
    "title": "string",
    "description": "string",
    "suggestedAssignee": null,
    "priority": "high"
  }
]
Allowed priorities: "high", "medium", "low".

Document Content:
${documentContent.substring(0, 12000)}`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt,
      langCode: 'en-US',
      personality: 'document_agent',
      operationType: 'TASK_EXTRACTION',
      provider: apiKeys.geminiKey ? 'gemini' : (apiKeys.openaiKey ? 'openai' : undefined),
      ...apiKeys
    });

    const parsed = parseStructuredJSON(response.response);
    return validateAndNormalizeTasks(parsed);
  } catch (error) {
    console.error('Error extracting tasks from document:', error.message);
    return [];
  }
};

/**
 * Parses user voice task management commands into structured actions
 */
export const parseTaskCommand = async (userPrompt, existingTasks = [], apiKeys) => {
  const formattedTasksList = existingTasks.map((t, idx) => 
    `Task ${idx + 1}: ID="${t.id}", Title="${t.title}", Status="${t.status}", Assignee="${t.assignee || 'Unassigned'}"`
  ).join('\n');

  const prompt = `You are a Task Management Assistant.
Existing tasks in project:
${formattedTasksList || '(No existing tasks)'}

User spoken command: "${userPrompt}"

Analyze the user's spoken command and map it to an action for one of the existing tasks (or list/query them).
Return STRICTLY a JSON object with this shape:
{
  "action": "assign" | "update_status" | "list" | "unknown",
  "taskId": "string or null",
  "assignee": "string or null",
  "status": "pending" | "in_progress" | "done" | null
}`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt,
      langCode: 'en-US',
      personality: 'respectful',
      operationType: 'VOICE_RESPONSE',
      provider: apiKeys.geminiKey ? 'gemini' : undefined,
      ...apiKeys
    });

    const parsed = parseStructuredJSON(response.response);
    return {
      action: parsed.action || 'unknown',
      taskId: parsed.taskId || null,
      assignee: parsed.assignee || null,
      status: ['pending', 'in_progress', 'done'].includes(parsed.status) ? parsed.status : null
    };
  } catch (error) {
    console.error('Error parsing task command:', error.message);
    return { action: 'unknown', taskId: null, assignee: null, status: null };
  }
};

/**
 * Classifies user intent into an agent type
 */
export const identifyAgentIntent = async (userPrompt, apiKeys) => {
  const p = (userPrompt || '').toLowerCase();

  // Fast deterministic heuristics for high-intent queries
  if (p.includes('brd') || (p.includes('business requirement') && !p.includes('task'))) {
    return 'brd';
  }
  if (p.includes('prd') || p.includes('product requirement')) {
    return 'prd';
  }
  if (p.includes('show task') || p.includes('show my tasks') || p.includes('task status') || p.includes('assign task') || p.includes('mark task')) {
    return 'task_command';
  }
  if (p.includes('competitor') && !p.includes('brd') && !p.includes('prd')) {
    return 'market_research';
  }

  const routerPrompt = `You are the AI Routing Engine for Bharat Startup Copilot.
Determine which AI Agent is best suited to handle the request.
Available Agents:
- idea_discovery: Refine startup concept, identify problem statement.
- brd: Create Business Requirement Document (BRD).
- prd: Create Product Requirement Document (PRD).
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
- task_command: Assign, reassign, mark status, or list existing tasks.
- general: Any other general chat query.

User Prompt: "${userPrompt}"

Respond ONLY with the exact string ID of the agent (e.g. "brd" or "task_command" or "general").`;

  try {
    const response = await getAIResponse({
      messages: [],
      prompt: routerPrompt,
      langCode: 'en-US',
      personality: 'respectful',
      operationType: 'VOICE_RESPONSE',
      ...apiKeys
    });
    
    const intent = response.response.trim().toLowerCase().replace(/[^a-z_]/g, '');
    if (AGENT_SYSTEM_PROMPTS[intent] || intent === 'general' || intent === 'task_command') {
      return intent;
    }
    return 'general';
  } catch (error) {
    console.error('Agent Router Error:', error.message);
    return 'general';
  }
};

/**
 * Executes a full Agent Workflow (e.g. BRD, PRD, Roadmap)
 * Includes Smart Research Pipeline (TinyFish) + Robust JSON Parsing + Atomic Prisma Transactions
 */
export const runAgentWorkflow = async (projectId, agentType, userPrompt, contextMessages, apiKeys) => {
  // If not a document agent, fall back to chat response
  if (!AGENT_SYSTEM_PROMPTS[agentType]) {
    return getAIResponse({
      messages: contextMessages,
      prompt: userPrompt,
      langCode: 'en-IN',
      personality: agentType,
      operationType: 'GENERAL_CHAT',
      ...apiKeys
    });
  }

  // 1. SMART RESEARCH PIPELINE (TinyFish)
  let liveResearchData = null;
  const needsResearch = shouldUseLiveResearch(userPrompt, agentType);

  if (needsResearch) {
    console.log(`[Agent Workflow] Live web research triggered for agent: ${agentType}`);
    liveResearchData = await researchForBRD(userPrompt);
  }

  // 2. Prepare Context & Enhanced System Prompt
  const agentBasePrompt = AGENT_SYSTEM_PROMPTS[agentType];
  let enhancedPrompt = `${agentBasePrompt}\n\nUser Request: ${userPrompt}`;

  if (liveResearchData && liveResearchData.available && liveResearchData.sources.length > 0) {
    enhancedPrompt += `\n\n=== VERIFIED LIVE WEB RESEARCH (Ground your analysis on this real data) ===
Primary Query: ${liveResearchData.query}
Identified Competitors: ${JSON.stringify(liveResearchData.competitors)}
Market Signals: ${JSON.stringify(liveResearchData.market_signals)}
Pricing Signals: ${JSON.stringify(liveResearchData.pricing_signals)}
Risks/Challenges: ${JSON.stringify(liveResearchData.risks)}
Verified Sources:
${liveResearchData.sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n')}
=== END RESEARCH DATA ===
(Note: Include these real sources in your metadata.sources array and ground the Competitor/Market Analysis in section 23 in these actual findings)`;
  } else if (needsResearch && liveResearchData && !liveResearchData.available) {
    enhancedPrompt += `\n\n[NOTICE: Live web research is currently unavailable (${liveResearchData.reason || 'offline'}). Proceed with high-quality internal domain reasoning. Do not invent fake URLs or statistics.]`;
  }

  enhancedPrompt += `\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. No leading or trailing commentary outside the JSON.`;

  const operationType = agentType === 'brd' ? 'BRD_GENERATION' : (agentType === 'prd' ? 'PRD_GENERATION' : 'GENERAL_CHAT');

  // 3. Call Primary LLM with long-output configuration
  let response = await getAIResponse({
    messages: contextMessages,
    prompt: enhancedPrompt,
    langCode: 'en-IN',
    personality: 'document_agent',
    operationType,
    provider: apiKeys.geminiKey ? 'gemini' : (apiKeys.openaiKey ? 'openai' : undefined),
    ...apiKeys
  });

  // 4. Parse & Validate Structured Output with controlled repair
  let parsedDocument = null;
  try {
    const rawParsed = parseStructuredJSON(response.response);
    parsedDocument = validateAndNormalizeBRD(rawParsed, `${agentType.toUpperCase()} Document`);
  } catch (parseErr) {
    console.warn(`[Agent Workflow] Initial JSON parse failed: ${parseErr.message}. Attempting single controlled repair...`);
    // Controlled repair prompt
    try {
      const repairPrompt = `The following text was supposed to be a strict JSON object for a ${agentType.toUpperCase()} document, but had formatting errors. Convert it into valid JSON with keys "title", "summary", "content", and "metadata":\n\n${response.response.substring(0, 8000)}`;
      const repairRes = await getAIResponse({
        messages: [],
        prompt: repairPrompt,
        langCode: 'en-US',
        personality: 'document_agent',
        operationType: 'BRD_GENERATION',
        provider: apiKeys.geminiKey ? 'gemini' : (apiKeys.openaiKey ? 'openai' : undefined),
        ...apiKeys
      });
      const repairedParsed = parseStructuredJSON(repairRes.response);
      parsedDocument = validateAndNormalizeBRD(repairedParsed, `${agentType.toUpperCase()} Document`);
    } catch (repairFatalErr) {
      console.error('[Agent Workflow] Repair attempt also failed:', repairFatalErr.message);
      return {
        response: "The AI agent was unable to produce valid structured document data. Please try again.",
        error: "JSON_VALIDATION_FAILED",
        raw: response.response,
        tasks: []
      };
    }
  }

  // Attach live research metadata if research was used
  if (liveResearchData && liveResearchData.available && liveResearchData.sources.length > 0) {
    parsedDocument.metadata.researchUsed = true;
    parsedDocument.metadata.sources = liveResearchData.sources;
  }

  // 5. Atomic Database Persistence
  if (projectId) {
    try {
      // Execute Document, Version, and Task extraction atomically in a Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create Document
        const document = await tx.document.create({
          data: {
            projectId,
            type: agentType,
            title: parsedDocument.title,
            content: parsedDocument.content
          }
        });

        // Create initial DocumentVersion
        await tx.documentVersion.create({
          data: {
            documentId: document.id,
            content: document.content,
            versionName: 'v1.0'
          }
        });

        // Extract tasks if BRD or PRD
        let createdTasks = [];
        if (agentType === 'brd' || agentType === 'prd') {
          const extracted = await extractTasksFromDocument(document.content, apiKeys);
          if (extracted && extracted.length > 0) {
            await tx.task.createMany({
              data: extracted.map(t => ({
                documentId: document.id,
                projectId,
                title: t.title,
                description: t.description,
                assignee: t.suggestedAssignee,
                priority: t.priority,
                source: `${agentType}_extraction`
              }))
            });

            createdTasks = await tx.task.findMany({
              where: { documentId: document.id },
              orderBy: { createdAt: 'asc' }
            });
          }
        }

        return { document, createdTasks };
      });

      const researchNote = parsedDocument.metadata.researchUsed
        ? ` Live research with ${parsedDocument.metadata.sources.length} sources was integrated.`
        : '';

      return {
        response: `BRD ready hai. Maine ${result.createdTasks.length} implementation tasks identify kiye hain.${researchNote}`,
        documentId: result.document.id,
        documentTitle: result.document.title,
        summary: parsedDocument.summary,
        metadata: parsedDocument.metadata,
        model: response.model,
        tasks: result.createdTasks
      };

    } catch (dbError) {
      console.error('[Agent Workflow] Database transaction error:', dbError.message);
      return {
        response: "Document generation succeeded, but saving to the database encountered an issue.",
        error: "DB_TRANSACTION_FAILED",
        preview: parsedDocument.content,
        tasks: []
      };
    }
  }

  // If no projectId provided
  return {
    response: `Generated successfully (Preview mode): ${parsedDocument.title}`,
    summary: parsedDocument.summary,
    content: parsedDocument.content,
    metadata: parsedDocument.metadata,
    model: response.model,
    tasks: []
  };
};
