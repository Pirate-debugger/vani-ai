import axios from 'axios';
import geminiProvider from './providers/geminiProvider.js';
import openaiProvider from './providers/openaiProvider.js';

export const streamAIResponse = async (messages, langCode, res, { sarvamKey, openaiKey, geminiKey }) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const emit = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const systemPrompt = `You are Vani AI, a friendly multilingual AI assistant for Indian users. Respond in language code "${langCode}". Keep replies under 5 sentences. Use simple language suitable for voice output. No markdown symbols in your reply — write plain text only.`;

  let buffer = '';

  const flushSentence = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 10) {
      emit({ tts_sentence: trimmed });
      buffer = '';
    }
  };

  // 1. Try Gemini streaming first if configured (Default fast reasoning provider)
  const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY;
  if (effectiveGeminiKey) {
    try {
      console.log('[Stream] Using native Gemini streamChat...');
      await geminiProvider.streamChat(messages, {
        apiKey: effectiveGeminiKey,
        systemPrompt,
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
      }, (token) => {
        if (!token) return;
        buffer += token;
        emit({ token });
        if (/[।.!?\n]/.test(token) && buffer.trim().length > 15) flushSentence();
      });

      flushSentence();
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err) {
      console.warn('[Stream] Gemini streaming failed, checking fallbacks...', err.message);
    }
  }

  // 2. Try OpenAI streaming
  const effectiveOpenAIKey = openaiKey || process.env.OPENAI_API_KEY;
  if (effectiveOpenAIKey) {
    try {
      console.log('[Stream] Using native OpenAI streamChat...');
      await openaiProvider.streamChat(messages, {
        apiKey: effectiveOpenAIKey,
        systemPrompt
      }, (token) => {
        if (!token) return;
        buffer += token;
        emit({ token });
        if (/[।.!?\n]/.test(token) && buffer.trim().length > 15) flushSentence();
      });

      flushSentence();
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err) {
      console.warn('[Stream] OpenAI failed, trying Sarvam...', err.message);
    }
  }

  // 3. Try Sarvam streaming
  const effectiveSarvamKey = sarvamKey || process.env.SARVAM_API_KEY;
  if (effectiveSarvamKey) {
    try {
      console.log('[Stream] Using Sarvam streaming...');
      const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
        model: 'sarvam-105b',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || [])
        ],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'api-subscription-key': effectiveSarvamKey,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(l => l.startsWith('data:'));
          for (const line of lines) {
            const raw = line.replace('data: ', '').trim();
            if (raw === '[DONE]') return;
            try {
              const parsed = JSON.parse(raw);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (!token) continue;
              buffer += token;
              emit({ token });
              if (/[।.!?\n]/.test(token) && buffer.trim().length > 15) flushSentence();
            } catch {}
          }
        });
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });

      flushSentence();
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err) {
      console.warn('[Stream] Sarvam streaming failed:', err.message);
    }
  }

  // No provider available or all failed — truthful error state, NO FAKE TOKENS!
  if (process.env.VANI_DEMO_MODE === 'true') {
    const fallbackText = 'Vani AI demo mode. Please configure your API key in Settings for live reasoning.';
    emit({ token: fallbackText });
    emit({ tts_sentence: fallbackText });
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  emit({
    error: 'All configured AI providers failed or are unconfigured. Please check your provider settings.',
    code: 'PROVIDER_UNAVAILABLE'
  });
  res.write('data: [DONE]\n\n');
  res.end();
};

export default {
  streamAIResponse
};
