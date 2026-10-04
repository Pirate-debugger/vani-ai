import { AGENT_REGISTRY, getAgent } from './agentRegistry.js';
import { 
  identifyAgentIntent, 
  extractTasksFromDocument,
  AGENT_SYSTEM_PROMPTS
} from './agentService.js';
import { researchForBRD, shouldUseLiveResearch } from './tinyfish.js';
import { parseStructuredJSON, validateAndNormalizeBRD } from '../lib/jsonParser.js';
import { resolveProviderForCapability, executeReasoning, needsWebResearch } from './providers/providerRouter.js';
import { getAIResponse } from './llm.js';
import prisma from '../lib/prisma.js';
import { verifyProjectOwnership } from '../middleware/auth.js';

/**
 * Master AI Orchestrator for Vani AI
 * Follows the execution pipeline:
 * USER REQUEST -> AUTHENTICATION/CONTEXT -> INTENT DETECTION -> AGENT SELECTION ->
 * PLAN -> CAPABILITY ROUTING -> TOOLS / PROVIDERS -> VALIDATION -> PERSISTENCE -> FINAL RESPONSE
 */
export async function orchestrate({
  prompt,
  messages = [],
  agentType,
  projectId = null,
  userId = null,
  languageCode = 'hi-IN',
  personality = 'respectful',
  profile = null,
  apiKeys = {},
  onEvent = () => {}
}) {
  const startTime = Date.now();
  const userPrompt = (prompt || (messages?.length ? messages[messages.length - 1].content : '') || '').trim();
  const executionSteps = [];

  const emit = (event) => {
    const enriched = {
      ...event,
      timestamp: Date.now(),
      elapsedMs: Date.now() - startTime
    };
    executionSteps.push(enriched);
    try {
      onEvent(enriched);
    } catch (e) {
      console.warn('[Orchestrator] onEvent error:', e.message);
    }
  };

  // 0. VERIFY PROJECT OWNERSHIP IF PROJECTID SUPPLIED
  let verifiedProject = null;
  if (projectId && userId) {
    try {
      verifiedProject = await verifyProjectOwnership(projectId, userId);
    } catch (authErr) {
      console.error('[Orchestrator] Security check failed:', authErr.message);
      const err = new Error('Access denied: You do not own this project.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  // 1. INTENT & AGENT CLASSIFICATION
  let selectedAgentId = agentType;
  if (!selectedAgentId || selectedAgentId === 'auto') {
    selectedAgentId = await identifyAgentIntent(userPrompt, apiKeys);
  }

  // Canonical normalization
  if (selectedAgentId === 'technical_architect') selectedAgentId = 'technical';
  if (selectedAgentId === 'task_command') selectedAgentId = 'task';
  if (selectedAgentId === 'market_research') selectedAgentId = 'research';

  const agentDef = getAgent(selectedAgentId);

  // 2. SIMPLE CONVERSATION & GENERAL CHAT (Rule 41: No unnecessary agentic steps)
  const isDocAgent = ['brd', 'prd', 'technical'].includes(agentDef.id);
  const isResearchAgent = agentDef.id === 'research';
  const explicitlyRequestsResearch = needsWebResearch(userPrompt) || shouldUseLiveResearch(userPrompt, agentDef.id);

  if (!isDocAgent && !isResearchAgent && !explicitlyRequestsResearch && agentDef.id === 'general') {
    emit({ 
      type: 'agent.started', 
      agent: agentDef.id, 
      name: agentDef.name,
      description: agentDef.description || 'Specialized AI Business Agent'
    });

    emit({ 
      type: 'agent.step', 
      step: 'generation', 
      status: 'running', 
      title: 'Generating response...', 
      provider: 'sarvam/gemini' 
    });

    const resolution = resolveProviderForCapability('general_chat', apiKeys);
    
    const chatRes = await getAIResponse({
      messages,
      prompt: userPrompt,
      langCode: languageCode,
      personality,
      profile,
      operationType: 'GENERAL_CHAT',
      provider: resolution.providerName,
      ...apiKeys
    });

    emit({ 
      type: 'agent.step', 
      step: 'generation', 
      status: 'completed', 
      title: 'Response ready', 
      provider: chatRes.model || resolution.providerName 
    });

    emit({ 
      type: 'agent.completed', 
      agent: agentDef.id, 
      providersUsed: [chatRes.model || resolution.providerName] 
    });

    return {
      response: chatRes.response,
      model: chatRes.model || resolution.providerName,
      simulated: chatRes.simulated || false,
      agentExecution: {
        agent: agentDef.id,
        agentName: agentDef.name,
        providersUsed: [chatRes.model || resolution.providerName],
        steps: executionSteps
      }
    };
  }

  // 3. START ACTUAL AGENT WORKFLOW (Emit real events)
  emit({ 
    type: 'agent.started', 
    agent: agentDef.id, 
    name: agentDef.name,
    description: agentDef.description || 'Specialized AI Business Agent'
  });

  emit({
    type: 'agent.step',
    step: 'understanding',
    status: 'completed',
    title: 'Understanding requirements',
    detail: `Goal: ${agentDef.name} analysis`
  });

  emit({
    type: 'agent.step',
    step: 'planning',
    status: 'completed',
    title: 'Planning',
    detail: `Mapped to ${agentDef.preferredProvider} execution pipeline`
  });

  // 4. LIVE WEB RESEARCH PIPELINE (TinyFish)
  let liveResearchData = null;
  const needsResearch = isResearchAgent || explicitlyRequestsResearch || agentDef.id === 'brd';

  if (needsResearch) {
    emit({ 
      type: 'agent.step',
      step: 'research',
      status: 'running',
      title: 'Researching competitors & market...' 
    });

    emit({ 
      type: 'tool.started', 
      tool: 'tinyfish.search', 
      step: 'research', 
      status: 'running', 
      title: 'Querying TinyFish live search index...' 
    });

    try {
      liveResearchData = await researchForBRD(userPrompt, { apiKey: apiKeys.tinyfishKey });
      const sourceCount = liveResearchData?.sources?.length || 0;
      
      emit({ 
        type: 'tool.completed', 
        tool: 'tinyfish.search', 
        step: 'research', 
        status: 'completed', 
        title: 'TinyFish Search & Fetch completed', 
        resultCount: sourceCount,
        sources: liveResearchData?.sources || []
      });

      emit({ 
        type: 'agent.step', 
        step: 'analyzing_research', 
        status: 'completed', 
        title: 'Analyzing research', 
        detail: `${sourceCount} verified sources found` 
      });
    } catch (resErr) {
      console.warn('[Orchestrator] Research error:', resErr.message);
      emit({ 
        type: 'tool.failed', 
        tool: 'tinyfish.search', 
        step: 'research', 
        status: 'failed', 
        title: 'Live research unavailable, proceeding with domain reasoning' 
      });
    }
  }

  // 5. IF RESEARCH AGENT (without BRD): Return grounded research synthesis directly
  if (isResearchAgent && !userPrompt.toLowerCase().includes('brd')) {
    const researchResolution = resolveProviderForCapability('research_synthesis', apiKeys);
    
    emit({
      type: 'agent.step',
      step: 'generation',
      status: 'running',
      title: 'Synthesizing market research...',
      provider: researchResolution.providerName
    });

    let researchPrompt = `You are a Senior AI Market Research Agent.
Analyze the user request and synthesize the findings using the verified live web research data provided below.
Compare competitors, pricing models, and key market trends. Ground every claim on the provided sources.

User Request: "${userPrompt}"`;

    if (liveResearchData && liveResearchData.available && liveResearchData.sources?.length > 0) {
      researchPrompt += `\n\n=== VERIFIED SOURCES ===\n` +
        liveResearchData.sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n') +
        `\n=== END SOURCES ===`;
    }

    const aiRes = await getAIResponse({
      messages,
      prompt: researchPrompt,
      langCode: languageCode,
      personality: 'research',
      operationType: 'RESEARCH_SYNTHESIS',
      provider: researchResolution.providerName,
      ...apiKeys
    });

    emit({
      type: 'agent.step',
      step: 'generation',
      status: 'completed',
      title: 'Market research synthesis ready',
      provider: aiRes.model || researchResolution.providerName
    });

    const providersUsed = Array.from(new Set([
      aiRes.model || researchResolution.providerName,
      liveResearchData?.available ? 'TinyFish' : null
    ].filter(Boolean)));

    emit({
      type: 'agent.completed',
      agent: 'research',
      providersUsed
    });

    return {
      response: aiRes.response,
      sources: liveResearchData?.sources || [],
      evidence: liveResearchData?.evidence || [],
      model: aiRes.model || researchResolution.providerName,
      agentExecution: {
        agent: 'research',
        agentName: 'Research Agent',
        providersUsed,
        steps: executionSteps
      }
    };
  }

  // 6. BUILD GROUNDED SYSTEM & USER PROMPT FOR BRD / STRUCTURED DOCUMENT
  const baseSystemPrompt = AGENT_SYSTEM_PROMPTS[agentDef.id] || AGENT_SYSTEM_PROMPTS.brd;
  let enhancedPrompt = `${baseSystemPrompt}\n\nUser Request: "${userPrompt}"`;

  if (liveResearchData && liveResearchData.available && liveResearchData.sources.length > 0) {
    enhancedPrompt += `\n\n=== VERIFIED LIVE WEB RESEARCH (Ground Section 23 Competitor Analysis and Market Insights on this real data) ===
Primary Query: ${liveResearchData.query}
Identified Competitors: ${JSON.stringify(liveResearchData.competitors)}
Market Signals: ${JSON.stringify(liveResearchData.market_signals)}
Pricing Signals: ${JSON.stringify(liveResearchData.pricing_signals)}
Risks/Challenges: ${JSON.stringify(liveResearchData.risks)}
Verified Sources:
${liveResearchData.sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n')}
=== END RESEARCH DATA ===
(Note: Include these real sources in metadata.sources and distinguish between USER FACT, RESEARCH FACT, INFERENCE, and ASSUMPTION)`;
  }

  enhancedPrompt += `\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. No commentary outside the JSON.`;

  // 7. CAPABILITY ROUTING FOR DOCUMENT GENERATION (Gemini -> OpenAI fallback)
  const capability = agentDef.id === 'technical' ? 'technical' : 'brd';
  const resolution = resolveProviderForCapability(capability, apiKeys);
  const chosenProviderName = resolution.providerName;

  emit({ 
    type: 'agent.step', 
    step: 'generation', 
    status: 'running', 
    title: `Generating ${agentDef.name}...`, 
    provider: chosenProviderName 
  });

  const response = await getAIResponse({
    messages,
    prompt: enhancedPrompt,
    langCode: 'en-IN',
    personality: 'document_agent',
    operationType: 'BRD_GENERATION',
    provider: chosenProviderName,
    ...apiKeys
  });

  // 8. PARSING & SCHEMA VALIDATION (Safe recovery)
  let parsedDocument = null;
  try {
    const rawParsed = parseStructuredJSON(response.response);
    parsedDocument = validateAndNormalizeBRD(rawParsed, `${agentDef.name}`);
    emit({ 
      type: 'agent.step', 
      step: 'generation', 
      status: 'completed', 
      title: `${agentDef.name} structured output generated`, 
      provider: response.model || chosenProviderName 
    });
  } catch (parseErr) {
    console.warn('[Orchestrator] Initial JSON parse failed, performing controlled schema repair:', parseErr.message);
    emit({ type: 'agent.step', step: 'repair', status: 'running', title: 'Repairing structured output format...' });
    
    const repairPrompt = `The following text was supposed to be a strict JSON object for a ${agentDef.name}, but had formatting errors. Convert it into valid JSON with keys "title", "summary", "content", and "metadata":\n\n${response.response.substring(0, 8000)}`;
    const repairRes = await getAIResponse({
      messages: [],
      prompt: repairPrompt,
      langCode: 'en-US',
      personality: 'document_agent',
      operationType: 'BRD_GENERATION',
      provider: chosenProviderName,
      ...apiKeys
    });
    const repairedParsed = parseStructuredJSON(repairRes.response);
    parsedDocument = validateAndNormalizeBRD(repairedParsed, `${agentDef.name}`);
    emit({ type: 'agent.step', step: 'repair', status: 'completed', title: 'Structured output repaired' });
  }

  // Attach live research metadata & real sources
  if (liveResearchData && liveResearchData.available && liveResearchData.sources?.length > 0) {
    parsedDocument.metadata = parsedDocument.metadata || {};
    parsedDocument.metadata.researchUsed = true;
    parsedDocument.metadata.sources = liveResearchData.sources;
    parsedDocument.metadata.evidence = liveResearchData.evidence || [];
  }

  // 9. TASK EXTRACTION
  let extractedTasks = [];
  emit({ type: 'agent.step', step: 'extracting_tasks', status: 'running', title: 'Extracting tasks' });
  try {
    extractedTasks = await extractTasksFromDocument(parsedDocument.content, apiKeys);
    emit({ 
      type: 'agent.step', 
      step: 'extracting_tasks', 
      status: 'completed', 
      title: 'Tasks extracted', 
      detail: `${extractedTasks.length} tasks` 
    });
  } catch (taskErr) {
    console.warn('[Orchestrator] Task extraction error:', taskErr.message);
    emit({ 
      type: 'agent.step', 
      step: 'extracting_tasks', 
      status: 'completed', 
      title: 'Tasks extracted', 
      detail: `0 tasks` 
    });
  }

  // 10. PERSISTENCE (Prisma Atomic Transaction if projectId provided)
  let savedDocId = null;
  let persistedTasks = extractedTasks;

  if (projectId) {
    emit({ type: 'agent.step', step: 'saving_document', status: 'running', title: 'Saving document' });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            projectId,
            type: agentDef.id,
            title: parsedDocument.title,
            content: parsedDocument.content,
            metadata: JSON.stringify(parsedDocument.metadata || {})
          }
        });

        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            content: doc.content,
            versionName: 'v1.0',
            metadata: JSON.stringify(parsedDocument.metadata || {})
          }
        });

        let dbTasks = [];
        if (extractedTasks.length > 0) {
          await tx.task.createMany({
            data: extractedTasks.map(t => ({
              documentId: doc.id,
              projectId,
              title: t.title,
              description: t.description || null,
              assignee: t.suggestedAssignee || null,
              priority: (t.priority || 'medium').toLowerCase(),
              source: `${agentDef.id}_extraction`
            }))
          });

          dbTasks = await tx.task.findMany({
            where: { documentId: doc.id },
            orderBy: { createdAt: 'asc' }
          });
        }

        return { doc, dbTasks };
      });

      savedDocId = result.doc.id;
      persistedTasks = result.dbTasks.length > 0 ? result.dbTasks : extractedTasks;
      emit({ type: 'agent.step', step: 'saving_document', status: 'completed', title: 'Document saved' });
    } catch (dbErr) {
      console.error('[Orchestrator] DB Save error:', dbErr.message);
      emit({ type: 'agent.step', step: 'saving_document', status: 'failed', title: 'Save failed, preview active' });
    }
  }

  const providersUsed = Array.from(new Set([
    response.model || chosenProviderName,
    liveResearchData?.available ? 'TinyFish Search' : null
  ].filter(Boolean)));

  emit({ 
    type: 'agent.completed', 
    agent: agentDef.id, 
    documentId: savedDocId, 
    title: parsedDocument.title,
    tasksCount: persistedTasks.length,
    providersUsed 
  });

  const researchNote = parsedDocument.metadata?.researchUsed
    ? ` Verified live web research with ${parsedDocument.metadata.sources.length} sources was integrated.`
    : '';

  return {
    response: `${agentDef.name} tayyar hai. Maine ${persistedTasks.length} implementation tasks identify kiye hain.${researchNote}`,
    title: parsedDocument.title,
    summary: parsedDocument.summary,
    content: parsedDocument.content,
    metadata: parsedDocument.metadata,
    documentId: savedDocId,
    tasks: persistedTasks,
    model: response.model || chosenProviderName,
    agentExecution: {
      agent: agentDef.id,
      agentName: agentDef.name,
      providersUsed,
      steps: executionSteps
    }
  };
}

export default {
  orchestrate
};
