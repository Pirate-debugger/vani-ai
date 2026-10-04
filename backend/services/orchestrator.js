import { AGENT_REGISTRY } from './agentRegistry.js';
import { 
  identifyAgentIntent, 
  extractTasksFromDocument,
  AGENT_SYSTEM_PROMPTS
} from './agentService.js';
import { researchForBRD, shouldUseLiveResearch } from './tinyfish.js';
import { parseStructuredJSON, validateAndNormalizeBRD } from '../lib/jsonParser.js';
import { getAIResponse } from './llm.js';
import prisma from '../lib/prisma.js';

/**
 * Master AI Orchestrator for Vani AI
 * Follows the execution pipeline:
 * USER REQUEST -> INTENT -> AGENT -> PLAN -> REQUIRED CAPABILITIES -> PROVIDER -> TOOLS -> EXECUTION -> VALIDATION -> PERSISTENCE -> RESPONSE
 */
export async function orchestrate({
  prompt,
  messages = [],
  agentType,
  projectId = null,
  languageCode = 'hi-IN',
  personality = 'respectful',
  profile = null,
  apiKeys = {},
  onEvent = () => {}
}) {
  const startTime = Date.now();
  const userPrompt = prompt || (messages?.length ? messages[messages.length - 1].content : '');
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

  // 1. INTENT & AGENT CLASSIFICATION
  let selectedAgentId = agentType;
  if (!selectedAgentId || selectedAgentId === 'auto') {
    emit({ type: 'agent.step', step: 'intent_classification', status: 'running', title: 'Analyzing intent...' });
    selectedAgentId = await identifyAgentIntent(userPrompt, apiKeys);
    emit({ 
      type: 'agent.step', 
      step: 'intent_classification', 
      status: 'completed', 
      title: 'Intent identified', 
      detail: `Selected: ${selectedAgentId}` 
    });
  }

  const agentDef = AGENT_REGISTRY[selectedAgentId] || {
    id: selectedAgentId || 'general',
    name: selectedAgentId ? `${selectedAgentId.toUpperCase()} Agent` : 'Conversational Agent',
    requiredCapabilities: ['chat'],
    preferredProvider: 'sarvam',
    fallbackProviders: ['gemini', 'openai'],
    supportsWebResearch: false
  };

  emit({ 
    type: 'agent.started', 
    agent: agentDef.id, 
    name: agentDef.name,
    description: agentDef.description || 'Specialized AI Business Agent'
  });

  // If general chat agent, delegate to multi-provider conversational pipeline
  if (selectedAgentId === 'general' || !AGENT_SYSTEM_PROMPTS[selectedAgentId]) {
    emit({ type: 'agent.step', step: 'generation', status: 'running', title: 'Generating response...', provider: 'sarvam/gemini' });
    const chatRes = await getAIResponse({
      messages,
      prompt: userPrompt,
      langCode: languageCode,
      personality,
      profile,
      operationType: 'GENERAL_CHAT',
      ...apiKeys
    });
    emit({ type: 'agent.step', step: 'generation', status: 'completed', title: 'Response ready', provider: chatRes.model });
    emit({ type: 'agent.completed', agent: agentDef.id, providersUsed: [chatRes.model || 'sarvam'] });

    return {
      response: chatRes.response,
      model: chatRes.model,
      simulated: chatRes.simulated,
      agentExecution: {
        agent: agentDef.id,
        agentName: agentDef.name,
        providersUsed: [chatRes.model || 'sarvam'],
        steps: executionSteps
      }
    };
  }

  // 2. LIVE WEB RESEARCH PIPELINE (TinyFish)
  let liveResearchData = null;
  const needsResearch = shouldUseLiveResearch(userPrompt, selectedAgentId);

  if (needsResearch) {
    emit({ 
      type: 'tool.started', 
      tool: 'tinyfish.search', 
      step: 'research', 
      status: 'running', 
      title: 'Researching live market and competitors...' 
    });

    try {
      liveResearchData = await researchForBRD(userPrompt);
      const sourceCount = liveResearchData?.sources?.length || 0;
      
      emit({ 
        type: 'tool.completed', 
        tool: 'tinyfish.search', 
        step: 'research', 
        status: 'completed', 
        title: 'Research completed', 
        detail: `${sourceCount} verified sources found`,
        sources: liveResearchData?.sources || []
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

  // 3. BUILD GROUNDED SYSTEM & USER PROMPT
  const agentBasePrompt = AGENT_SYSTEM_PROMPTS[selectedAgentId];
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
(Note: Include these real sources in your metadata.sources array and ground Section 23 Competitor Analysis in these actual findings)`;
  }

  enhancedPrompt += `\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. No leading or trailing commentary outside the JSON.`;

  // 4. EXECUTION VIA PROVIDER (Gemini 3.5 Flash -> OpenAI -> Sarvam)
  const operationType = selectedAgentId === 'brd' ? 'BRD_GENERATION' : (selectedAgentId === 'prd' ? 'PRD_GENERATION' : 'GENERAL_CHAT');
  const chosenProvider = apiKeys.geminiKey ? 'gemini-3.5-flash' : (apiKeys.openaiKey ? 'openai' : 'sarvam');

  emit({ 
    type: 'agent.step', 
    step: 'generation', 
    status: 'running', 
    title: `Generating ${agentDef.name}...`, 
    provider: chosenProvider 
  });

  const response = await getAIResponse({
    messages,
    prompt: enhancedPrompt,
    langCode: 'en-IN',
    personality: 'document_agent',
    operationType,
    provider: apiKeys.geminiKey ? 'gemini' : (apiKeys.openaiKey ? 'openai' : undefined),
    ...apiKeys
  });

  // 5. VALIDATION & PARSING
  let parsedDocument = null;
  try {
    const rawParsed = parseStructuredJSON(response.response);
    parsedDocument = validateAndNormalizeBRD(rawParsed, `${selectedAgentId.toUpperCase()} Document`);
    emit({ 
      type: 'agent.step', 
      step: 'generation', 
      status: 'completed', 
      title: `${agentDef.name} structured output generated`, 
      provider: response.model || chosenProvider 
    });
  } catch (parseErr) {
    console.warn('[Orchestrator] Initial JSON parse failed, attempting controlled repair:', parseErr.message);
    emit({ type: 'agent.step', step: 'repair', status: 'running', title: 'Repairing structured output format...' });
    
    const repairPrompt = `The following text was supposed to be a strict JSON object for a ${selectedAgentId.toUpperCase()} document, but had formatting errors. Convert it into valid JSON with keys "title", "summary", "content", and "metadata":\n\n${response.response.substring(0, 8000)}`;
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
    parsedDocument = validateAndNormalizeBRD(repairedParsed, `${selectedAgentId.toUpperCase()} Document`);
    emit({ type: 'agent.step', step: 'repair', status: 'completed', title: 'Structured output repaired' });
  }

  // Attach live research metadata if research was used
  if (liveResearchData && liveResearchData.available && liveResearchData.sources.length > 0) {
    parsedDocument.metadata.researchUsed = true;
    parsedDocument.metadata.sources = liveResearchData.sources;
  }

  // 6. TASK EXTRACTION
  let extractedTasks = [];
  if (selectedAgentId === 'brd' || selectedAgentId === 'prd') {
    emit({ type: 'agent.step', step: 'task_extraction', status: 'running', title: 'Extracting actionable implementation tasks...' });
    extractedTasks = await extractTasksFromDocument(parsedDocument.content, apiKeys);
    emit({ 
      type: 'agent.step', 
      step: 'task_extraction', 
      status: 'completed', 
      title: 'Task extraction completed', 
      detail: `${extractedTasks.length} tasks identified` 
    });
  }

  // 7. PERSISTENCE (Prisma Transaction if projectId provided)
  let savedDocId = null;
  let persistedTasks = extractedTasks;

  if (projectId) {
    emit({ type: 'agent.step', step: 'persistence', status: 'running', title: 'Saving document and tasks to project...' });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            projectId,
            type: selectedAgentId,
            title: parsedDocument.title,
            content: parsedDocument.content
          }
        });

        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            content: doc.content,
            versionName: 'v1.0'
          }
        });

        let dbTasks = [];
        if (extractedTasks.length > 0) {
          await tx.task.createMany({
            data: extractedTasks.map(t => ({
              documentId: doc.id,
              projectId,
              title: t.title,
              description: t.description,
              assignee: t.suggestedAssignee,
              priority: t.priority,
              source: `${selectedAgentId}_extraction`
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
      emit({ type: 'agent.step', step: 'persistence', status: 'completed', title: 'Document and tasks saved' });
    } catch (dbErr) {
      console.error('[Orchestrator] DB Save error:', dbErr.message);
      emit({ type: 'agent.step', step: 'persistence', status: 'failed', title: 'Save failed, available in preview' });
    }
  }

  const providersUsed = Array.from(new Set([
    response.model || chosenProvider,
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

  const researchNote = parsedDocument.metadata.researchUsed
    ? ` Live web research with ${parsedDocument.metadata.sources.length} sources was integrated.`
    : '';

  return {
    response: `${agentDef.name} ready hai. Maine ${persistedTasks.length} implementation tasks identify kiye hain.${researchNote}`,
    title: parsedDocument.title,
    summary: parsedDocument.summary,
    content: parsedDocument.content,
    metadata: parsedDocument.metadata,
    documentId: savedDocId,
    tasks: persistedTasks,
    model: response.model || chosenProvider,
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
