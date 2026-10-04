import { describe, it, expect, vi, beforeEach } from 'vitest';
import sarvamProvider, { SARVAM_MODELS, SUPPORTED_LANGUAGES } from '../services/providers/sarvamProvider.js';
import openaiProvider, { OPENAI_MODELS } from '../services/providers/openaiProvider.js';
import geminiProvider, { GEMINI_MODELS } from '../services/providers/geminiProvider.js';
import tinyfishProvider from '../services/providers/tinyfishProvider.js';
import providerRouter, { needsWebResearch, getProvidersStatus } from '../services/providers/providerRouter.js';
import agentRegistry, { getAgent, listAgents } from '../services/agentRegistry.js';

describe('Centralized AI Provider Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sarvam Provider', () => {
    it('uses Saaras v4 for STT, Bulbul v3 for TTS, and Sarvam-105B for LLM', () => {
      expect(SARVAM_MODELS.STT).toBe('saaras:v4');
      expect(SARVAM_MODELS.TTS).toBe('bulbul:v3');
      expect(SARVAM_MODELS.TRANSLATION).toBe('mayura:v1');
      expect(SARVAM_MODELS.LLM).toBe('sarvam-105b');
    });

    it('supports major Indian languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('hi-IN');
      expect(SUPPORTED_LANGUAGES).toContain('en-IN');
      expect(SUPPORTED_LANGUAGES).toContain('ta-IN');
      expect(SUPPORTED_LANGUAGES).toContain('te-IN');
      expect(SUPPORTED_LANGUAGES).toContain('mr-IN');
      expect(SUPPORTED_LANGUAGES).toContain('bn-IN');
    });

    it('transcribeAudio returns simulated transcript when key is absent', async () => {
      const res = await sarvamProvider.transcribeAudio(Buffer.from('fake-audio'), { languageCode: 'hi-IN' });
      expect(res.transcript).toBeDefined();
      expect(res.simulated).toBe(true);
    });

    it('synthesizeSpeech returns audio base64 when key is absent', async () => {
      const res = await sarvamProvider.synthesizeSpeech('BRD ban gaya hai', { targetLanguage: 'hi-IN' });
      expect(res.audioBase64).toBeDefined();
      expect(res.simulated).toBe(true);
    });

    it('translateText returns simulated translation when key is absent', async () => {
      const res = await sarvamProvider.translateText('Hello', { sourceLanguage: 'en-IN', targetLanguage: 'hi-IN' });
      expect(res.translatedText).toBe('Hello');
      expect(res.simulated).toBe(true);
    });

    it('chatCompletion operates in fallback mode without crashing', async () => {
      const res = await sarvamProvider.chatCompletion([{ role: 'user', content: 'Namaste' }]);
      expect(res.text).toBeDefined();
      expect(res.provider).toBe('sarvam');
    });
  });

  describe('OpenAI Provider', () => {
    it('defines distinct model tiers for chat, reasoning, document, and code', () => {
      expect(OPENAI_MODELS.CHAT).toBeDefined();
      expect(OPENAI_MODELS.REASONING).toBeDefined();
      expect(OPENAI_MODELS.DOCUMENT).toBeDefined();
      expect(OPENAI_MODELS.CODE).toBeDefined();
    });

    it('generates simulated structured output when key is absent', async () => {
      const res = await openaiProvider.generateStructured('Create BRD for PG finder');
      expect(res.text).toBeDefined();
      expect(res.provider).toBe('openai');
      const parsed = JSON.parse(res.text);
      expect(parsed.title).toBeDefined();
      expect(parsed.content).toBeDefined();
    });
  });

  describe('Gemini Provider', () => {
    it('defines configurable models for fast and reasoning tasks', () => {
      expect(GEMINI_MODELS.FAST).toBeDefined();
      expect(GEMINI_MODELS.DOCUMENT).toBeDefined();
    });

    it('generates simulated structured output when key is absent', async () => {
      const res = await geminiProvider.generateStructured('Create BRD for student startup');
      expect(res.text).toBeDefined();
      expect(res.provider).toBe('gemini');
      const parsed = JSON.parse(res.text);
      expect(parsed.title).toBeDefined();
    });
  });

  describe('TinyFish Provider', () => {
    it('provides search, fetch, web agent, and researchWeb capabilities', () => {
      expect(typeof tinyfishProvider.searchWeb).toBe('function');
      expect(typeof tinyfishProvider.fetchWeb).toBe('function');
      expect(typeof tinyfishProvider.runWebAgent).toBe('function');
      expect(typeof tinyfishProvider.researchWeb).toBe('function');
      expect(typeof tinyfishProvider.compareWebSources).toBe('function');
    });

    it('researchWeb returns clean fallback structure when offline', async () => {
      const res = await tinyfishProvider.researchWeb('PG accommodations in Bangalore');
      expect(res.query).toBe('PG accommodations in Bangalore');
      expect(res.researchUsed).toBe(false);
      expect(Array.isArray(res.sources)).toBe(true);
    });
  });

  describe('Provider Router & Intent Routing', () => {
    it('needsWebResearch returns true for competitor and market research queries', () => {
      expect(needsWebResearch('Create BRD and research current competitors')).toBe(true);
      expect(needsWebResearch('Find latest PG prices in Pune')).toBe(true);
      expect(needsWebResearch('Compare current products in market')).toBe(true);
      expect(needsWebResearch('Search latest government scheme for startups')).toBe(true);
    });

    it('needsWebResearch returns false for basic chat, calculations, and rewrites', () => {
      expect(needsWebResearch('Hello Vani, how are you?')).toBe(false);
      expect(needsWebResearch('Rewrite this paragraph in formal English')).toBe(false);
      expect(needsWebResearch('Explain database normalization')).toBe(false);
      expect(needsWebResearch('Summarize this text: The product is good.')).toBe(false);
    });

    it('getProvidersStatus reports configuration status for all providers without leaking secrets', () => {
      const status = getProvidersStatus();
      expect(status.sarvam).toBeDefined();
      expect(status.openai).toBeDefined();
      expect(status.gemini).toBeDefined();
      expect(status.tinyfish).toBeDefined();
      expect(typeof status.sarvam.configured).toBe('boolean');
      expect(typeof status.tinyfish.configured).toBe('boolean');
      // Must not leak raw secrets
      expect(JSON.stringify(status)).not.toContain('AIzaSy');
      expect(JSON.stringify(status)).not.toContain('sk-');
    });

    it('executeReasoning routes to preferred provider and produces structured response', async () => {
      const res = await providerRouter.executeReasoning('Generate summary', {
        structured: true,
        preferredProvider: 'gemini'
      });
      expect(res.text).toBeDefined();
      expect(res.provider).toBeDefined();
    });
  });

  describe('Agent Registry', () => {
    it('registers all 19 canonical business & workflow agents', () => {
      const agents = listAgents();
      expect(agents.length).toBe(19);
      const agentIds = agents.map(a => a.id);
      expect(agentIds).toContain('brd');
      expect(agentIds).toContain('prd');
      expect(agentIds).toContain('idea_discovery');
      expect(agentIds).toContain('idea_validation');
      expect(agentIds).toContain('market_research');
      expect(agentIds).toContain('research');
      expect(agentIds).toContain('startup');
      expect(agentIds).toContain('roadmap');
      expect(agentIds).toContain('user_story');
      expect(agentIds).toContain('technical_architect');
      expect(agentIds).toContain('ux_designer');
      expect(agentIds).toContain('funding');
      expect(agentIds).toContain('student');
      expect(agentIds).toContain('investor');
      expect(agentIds).toContain('hackathon');
      expect(agentIds).toContain('task_command');
      expect(agentIds).toContain('general');
      expect(agentIds).toContain('build');
      expect(agentIds).toContain('plan');
    });

    it('retrieves agent definition with required capabilities and preferred provider', () => {
      const brd = getAgent('brd');
      expect(brd.name).toBe('BRD Generation Agent');
      expect(brd.supportsWebResearch).toBe(true);
      expect(brd.preferredProvider).toBe('gemini');
      expect(brd.outputSchema).toBeDefined();
    });
  });
});
