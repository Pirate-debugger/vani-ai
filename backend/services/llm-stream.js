import axios from 'axios';

export const streamAIResponse = async (messages, langCode, res, { sarvamKey, openaiKey }) => {
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

  // Try OpenAI streaming first (most reliable)
  if (openaiKey) {
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        temperature: 0.7,
        max_tokens: 350,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || [])
        ]
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (!token) continue;
        buffer += token;
        emit({ token });
        if (/[।.!?]/.test(token) && buffer.trim().length > 15) flushSentence();
      }

      flushSentence();
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err) {
      console.warn('[Stream] OpenAI failed, trying Sarvam...', err.message);
    }
  }

  // Try Sarvam streaming
  if (sarvamKey) {
    try {
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
          'api-subscription-key': sarvamKey,
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
              if (/[।.!?]/.test(token) && buffer.trim().length > 15) flushSentence();
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
      console.warn('[Stream] Sarvam streaming failed, using simulator...', err.message);
    }
  }

  // Simulator fallback — word by word
  const fallbacks = {
    'hi-IN': 'नमस्ते! मैं वाणी एआई हूँ। मैं आपकी सहायता के लिए यहाँ हूँ। आप मुझसे पीजी, नौकरी, या सरकारी योजनाओं के बारे में पूछ सकते हैं।',
    'en-IN': 'Hello! I am Vani AI, your multilingual assistant. I can help you find PG accommodations, jobs, and information about government schemes.',
    'ta-IN': 'வணக்கம்! நான் வாணி ஏஐ. நான் உங்களுக்கு பிஜி, வேலை மற்றும் அரசு திட்டங்கள் பற்றி உதவ முடியும்.',
  };
  const fallbackText = fallbacks[langCode] || fallbacks['en-IN'];
  const words = fallbackText.split(' ');
  for (const word of words) {
    emit({ token: word + ' ' });
    await new Promise(r => setTimeout(r, 60));
  }
  emit({ tts_sentence: fallbackText });
  res.write('data: [DONE]\n\n');
  res.end();
};
