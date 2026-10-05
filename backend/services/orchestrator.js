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
import geminiProvider from './providers/geminiProvider.js';
import openaiProvider from './providers/openaiProvider.js';
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
  requestId = null,
  languageCode = 'hi-IN',
  personality = 'respectful',
  profile = null,
  apiKeys = {},
  signal = null,
  onEvent = () => {}
}) {
  const startTime = Date.now();
  const userPrompt = (prompt || (messages?.length ? messages[messages.length - 1].content : '') || '').trim();
  const executionSteps = [];

  const emit = (event) => {
    const enriched = {
      ...event,
      runId: requestId || null,
      projectId: projectId || null,
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

  // 0B. PERSISTENT IDEMPOTENCY VIA AGENTRUN (Rule 14 & 17)
  let agentRunRecord = null;
  let validDbUserId = null;
  if (userId) {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (u) validDbUserId = u.id;
    } catch {}
  }

  if (requestId) {
    try {
      const existingRun = await prisma.agentRun.findUnique({
        where: { requestId }
      });
      if (existingRun && existingRun.status === 'completed' && existingRun.result) {
        console.log(`[Orchestrator] Idempotency hit: returning cached result for requestId ${requestId}`);
        const cached = JSON.parse(existingRun.result);
        emit({ type: 'final.result', result: cached });
        return cached;
      }
      if (existingRun && existingRun.status === 'running') {
        const err = new Error('Task is already running.');
        err.code = 'TASK_ALREADY_RUNNING';
        err.status = 409;
        throw err;
      }

      agentRunRecord = await prisma.agentRun.create({
        data: {
          requestId,
          userId: validDbUserId,
          projectId: projectId || null,
          agentId: agentType || 'auto',
          mode: 'auto',
          status: 'running',
          prompt: userPrompt
        }
      });
    } catch (e) {
      if (e.code === 'TASK_ALREADY_RUNNING') throw e;
      console.warn('[Orchestrator] AgentRun tracking warn:', e.message);
    }
  }

  try {
    if (signal?.aborted) {
      throw new Error('Run was cancelled by client');
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

    // Check for custom agent with strict ownership verification (Rule 22)
    let customAgentRecord = null;
    if (selectedAgentId && (selectedAgentId.startsWith('custom_') || selectedAgentId.length > 20)) {
      const cleanId = selectedAgentId.replace(/^custom_/, '');
      if (!userId) {
        const err = new Error('Authentication required to invoke custom agents.');
        err.status = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
      }

      customAgentRecord = await prisma.customAgent.findFirst({
        where: { id: cleanId, userId }
      });

      if (!customAgentRecord) {
        const err = new Error('Custom agent not found or access denied.');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    let agentDef;
    if (customAgentRecord) {
      let customTools = [];
      try { customTools = JSON.parse(customAgentRecord.tools || '[]'); } catch { customTools = []; }
      const hasWebSearch = customTools.includes('web_search') || customTools.includes('web_fetch');

      agentDef = {
        id: `custom_${customAgentRecord.id}`,
        name: customAgentRecord.name,
        description: customAgentRecord.description || 'Custom User Agent',
        instructions: customAgentRecord.instructions,
        preferredProvider: customAgentRecord.preferredModel !== 'auto' ? customAgentRecord.preferredModel : 'gemini',
        fallbackProviders: ['openai', 'gemini'],
        supportsWebResearch: hasWebSearch,
        supportsTools: customTools.length > 0,
        tools: hasWebSearch ? ['tinyfish.search', 'tinyfish.fetch'] : [],
        outputType: 'text',
        isCustom: true
      };
    } else {
      agentDef = getAgent(selectedAgentId);
    }

    // 2. SIMPLE CONVERSATION & GENERAL CHAT (Rule 8: Fast, no unnecessary research/BRD steps)
    const isDocAgent = ['brd', 'prd', 'technical', 'build', 'plan'].includes(agentDef.id);
    const isResearchAgent = agentDef.id === 'research';
    const explicitlyRequestsResearch = needsWebResearch(userPrompt) || shouldUseLiveResearch(userPrompt, agentDef.id);

    if (!isDocAgent && !isResearchAgent && !explicitlyRequestsResearch && agentDef.id === 'general' && !agentDef.isCustom) {
      emit({ 
        type: 'agent.started', 
        agent: agentDef.id, 
        name: agentDef.name,
        description: agentDef.description || 'Specialized AI Assistant'
      });

      emit({ 
        type: 'agent.step', 
        step: 'generation', 
        status: 'running', 
        title: 'Generating response...', 
        provider: 'gemini' 
      });

      const resolution = resolveProviderForCapability('general_chat', apiKeys);
      let streamedResponse = '';
      let usedModel = resolution.providerName;

      // Real token streaming with provider (Rule 11)
      if (resolution.providerName === 'gemini' && (apiKeys.geminiKey || process.env.GEMINI_API_KEY)) {
        try {
          const streamResult = await geminiProvider.streamChat(
            messages.length ? messages : userPrompt,
            {
              apiKey: apiKeys.geminiKey || process.env.GEMINI_API_KEY,
              systemPrompt: `You are Vani AI, a helpful, intelligent multilingual AI assistant for India. Respond clearly and naturally in ${languageCode}.`
            },
            (token) => {
              if (token) {
                streamedResponse += token;
                emit({ type: 'stream.chunk', delta: token });
              }
            }
          );
          usedModel = streamResult.model;
        } catch (sErr) {
          console.warn('[Orchestrator] Gemini stream failed, falling back to standard resolution:', sErr.message);
        }
      } else if (resolution.providerName === 'openai' && (apiKeys.openaiKey || process.env.OPENAI_API_KEY)) {
        try {
          const streamResult = await openaiProvider.streamChat(
            messages.length ? messages : userPrompt,
            {
              apiKey: apiKeys.openaiKey || process.env.OPENAI_API_KEY,
              systemPrompt: `You are Vani AI, a helpful, intelligent multilingual AI assistant for India. Respond clearly and naturally in ${languageCode}.`
            },
            (token) => {
              if (token) {
                streamedResponse += token;
                emit({ type: 'stream.chunk', delta: token });
              }
            }
          );
          usedModel = streamResult.model;
        } catch (sErr) {
          console.warn('[Orchestrator] OpenAI stream failed, falling back to standard resolution:', sErr.message);
        }
      }

      if (!streamedResponse) {
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
        streamedResponse = chatRes.response;
        usedModel = chatRes.model || resolution.providerName;
        emit({ type: 'stream.chunk', delta: streamedResponse });
      }

      emit({ 
        type: 'agent.step', 
        step: 'generation', 
        status: 'completed', 
        title: 'Response ready', 
        provider: usedModel 
      });

      emit({ 
        type: 'agent.completed', 
        agent: agentDef.id, 
        providersUsed: [usedModel] 
      });

      const finalOutput = {
        response: streamedResponse,
        model: usedModel,
        simulated: false,
        agentExecution: {
          agent: agentDef.id,
          agentName: agentDef.name,
          providersUsed: [usedModel],
          steps: executionSteps
        }
      };

      if (agentRunRecord) {
        await prisma.agentRun.update({
          where: { id: agentRunRecord.id },
          data: {
            status: 'completed',
            model: usedModel,
            result: JSON.stringify(finalOutput),
            completedAt: new Date()
          }
        }).catch(err => console.warn('[Orchestrator] AgentRun finalize warn:', err.message));
      }

      return finalOutput;
    }

    // 3. START ACTUAL AGENT WORKFLOW
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
        
        if (liveResearchData && liveResearchData.available && sourceCount > 0) {
          emit({ 
            type: 'tool.completed', 
            tool: 'tinyfish.search', 
            step: 'research', 
            status: 'completed', 
            title: 'TinyFish Search & Fetch completed', 
            resultCount: sourceCount,
            sources: liveResearchData.sources
          });

          emit({ 
            type: 'agent.step', 
            step: 'analyzing_research', 
            status: 'completed', 
            title: 'Analyzing research', 
            detail: `${sourceCount} verified sources found` 
          });
        } else {
          emit({ 
            type: 'tool.failed', 
            tool: 'tinyfish.search', 
            step: 'research', 
            status: 'failed', 
            title: 'Live research unavailable',
            detail: liveResearchData?.note || 'No web sources retrieved'
          });
        }
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

    if (signal?.aborted) throw new Error('Run was cancelled by client');

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

      let streamedText = '';
      let usedModel = researchResolution.providerName;

      if (researchResolution.providerName === 'gemini' && (apiKeys.geminiKey || process.env.GEMINI_API_KEY)) {
        try {
          const res = await geminiProvider.streamChat(
            researchPrompt,
            { apiKey: apiKeys.geminiKey || process.env.GEMINI_API_KEY, systemPrompt: 'Senior AI Market Researcher' },
            (token) => {
              streamedText += token;
              emit({ type: 'stream.chunk', delta: token });
            }
          );
          usedModel = res.model;
        } catch {}
      }

      if (!streamedText) {
        const aiRes = await getAIResponse({
          messages,
          prompt: researchPrompt,
          langCode: languageCode,
          personality: 'research',
          operationType: 'RESEARCH_SYNTHESIS',
          provider: researchResolution.providerName,
          ...apiKeys
        });
        streamedText = aiRes.response;
        usedModel = aiRes.model || researchResolution.providerName;
        emit({ type: 'stream.chunk', delta: streamedText });
      }

      emit({
        type: 'agent.step',
        step: 'generation',
        status: 'completed',
        title: 'Market research synthesis ready',
        provider: usedModel
      });

      const providersUsed = Array.from(new Set([
        usedModel,
        liveResearchData?.available ? 'TinyFish' : null
      ].filter(Boolean)));

      emit({
        type: 'agent.completed',
        agent: 'research',
        providersUsed
      });

      const finalOutput = {
        response: streamedText,
        sources: liveResearchData?.sources || [],
        evidence: liveResearchData?.evidence || [],
        model: usedModel,
        agentExecution: {
          agent: 'research',
          agentName: 'Research Agent',
          providersUsed,
          steps: executionSteps
        }
      };

      if (agentRunRecord) {
        await prisma.agentRun.update({
          where: { id: agentRunRecord.id },
          data: {
            status: 'completed',
            model: usedModel,
            result: JSON.stringify(finalOutput),
            completedAt: new Date()
          }
        }).catch(() => {});
      }

      return finalOutput;
    }

    // 5B. CUSTOM AGENT EXECUTION
    if (agentDef.isCustom) {
      emit({
        type: 'agent.step',
        step: 'generation',
        status: 'running',
        title: `Generating with ${agentDef.name}...`,
        provider: agentDef.preferredProvider
      });

      let customPrompt = `${agentDef.instructions}\n\nUser Request: "${userPrompt}"`;
      if (liveResearchData && liveResearchData.available && liveResearchData.sources?.length > 0) {
        customPrompt += `\n\n=== VERIFIED LIVE WEB RESEARCH ===\n` +
          liveResearchData.sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`).join('\n') +
          `\n=== END RESEARCH DATA ===`;
      }

      const customResolution = resolveProviderForCapability(
        agentDef.supportsWebResearch ? 'research' : 'general_chat',
        apiKeys
      );
      const chosenProvider = (agentDef.preferredProvider && agentDef.preferredProvider !== 'auto') 
        ? agentDef.preferredProvider 
        : customResolution.providerName;

      let customText = '';
      let usedCustomModel = chosenProvider;

      if (chosenProvider === 'gemini' && (apiKeys.geminiKey || process.env.GEMINI_API_KEY)) {
        try {
          const res = await geminiProvider.streamChat(
            customPrompt,
            { apiKey: apiKeys.geminiKey || process.env.GEMINI_API_KEY, systemPrompt: agentDef.instructions },
            (token) => {
              customText += token;
              emit({ type: 'stream.chunk', delta: token });
            }
          );
          usedCustomModel = res.model;
        } catch {}
      }

      if (!customText) {
        const aiRes = await getAIResponse({
          messages,
          prompt: customPrompt,
          langCode: languageCode,
          personality: 'custom',
          operationType: 'GENERAL_CHAT',
          provider: chosenProvider,
          ...apiKeys
        });
        customText = aiRes.response;
        usedCustomModel = aiRes.model || chosenProvider;
        emit({ type: 'stream.chunk', delta: customText });
      }

      emit({
        type: 'agent.step',
        step: 'generation',
        status: 'completed',
        title: `${agentDef.name} response ready`,
        provider: usedCustomModel
      });

      const providersUsed = Array.from(new Set([
        usedCustomModel,
        liveResearchData?.available ? 'TinyFish' : null
      ].filter(Boolean)));

      emit({
        type: 'agent.completed',
        agent: agentDef.id,
        name: agentDef.name,
        providersUsed
      });

      const finalOutput = {
        response: customText,
        sources: liveResearchData?.sources || [],
        evidence: liveResearchData?.evidence || [],
        model: usedCustomModel,
        agentExecution: {
          agent: agentDef.id,
          agentName: agentDef.name,
          providersUsed,
          steps: executionSteps
        }
      };

      if (agentRunRecord) {
        await prisma.agentRun.update({
          where: { id: agentRunRecord.id },
          data: {
            status: 'completed',
            model: usedCustomModel,
            result: JSON.stringify(finalOutput),
            completedAt: new Date()
          }
        }).catch(() => {});
      }

      return finalOutput;
    }

    // 6. BUILD GROUNDED SYSTEM & USER PROMPT FOR BRD / STRUCTURED DOCUMENT
    const baseSystemPrompt = AGENT_SYSTEM_PROMPTS[agentDef.id] || AGENT_SYSTEM_PROMPTS.brd;
    let enhancedPrompt = `${baseSystemPrompt}\n\nUser Request: "${userPrompt}"`;

    if (liveResearchData && liveResearchData.available && liveResearchData.sources?.length > 0) {
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
    const capability = (agentDef.id === 'technical' || agentDef.id === 'build') ? 'coding' : 'brd';
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

    // Attach truthful live research metadata & real sources (Rule 10 & 32)
    parsedDocument.metadata = parsedDocument.metadata || {};
    if (liveResearchData && liveResearchData.available && liveResearchData.sources?.length > 0) {
      parsedDocument.metadata.researchUsed = true;
      parsedDocument.metadata.sources = liveResearchData.sources;
      parsedDocument.metadata.evidence = liveResearchData.evidence || [];
    } else {
      parsedDocument.metadata.researchUsed = false;
      parsedDocument.metadata.sources = [];
      parsedDocument.metadata.evidence = [];
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

    const finalOutput = {
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

    if (agentRunRecord) {
      await prisma.agentRun.update({
        where: { id: agentRunRecord.id },
        data: {
          status: 'completed',
          model: response.model || chosenProviderName,
          result: JSON.stringify(finalOutput),
          completedAt: new Date()
        }
      }).catch(() => {});
    }

    return finalOutput;

  } catch (executionError) {
    console.error('[Orchestrator] Execution failed:', executionError.message);
    if (agentRunRecord) {
      await prisma.agentRun.update({
        where: { id: agentRunRecord.id },
        data: {
          status: signal?.aborted ? 'cancelled' : 'failed',
          error: executionError.message,
          completedAt: new Date()
        }
      }).catch(() => {});
    }
    throw executionError;
  }
}

export default {
  orchestrate
};
