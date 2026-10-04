import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import prisma from '../lib/prisma.js';
import { decryptKey } from '../lib/crypto.js';
import { getAIResponse } from '../services/llm.js';
import { runAgentWorkflow, identifyAgentIntent, parseTaskCommand } from '../services/agentService.js';
import { getAuthUser, verifyProjectOwnership, verifyTaskOwnership } from '../middleware/auth.js';

const router = express.Router();

// Multer in-memory upload setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      const err = new Error('Only audio files are accepted');
      err.status = 415;
      cb(err, false);
    }
  }
});

// Helper to resolve Sarvam API key
const getSarvamKey = async (req) => {
  if (req.cachedSarvamKey) return req.cachedSarvamKey;

  const user = getAuthUser(req);
  if (user && user.id) {
    try {
      const apiKeyRow = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'sarvam' } }
      });
      if (apiKeyRow && apiKeyRow.encryptedKey) {
        const decrypted = decryptKey(apiKeyRow.encryptedKey);
        req.cachedSarvamKey = decrypted;
        return decrypted;
      }
    } catch (err) {
      console.error('Error fetching API key from DB:', err.message);
    }
  }

  return process.env.SARVAM_API_KEY;
};

// Helper to resolve Gemini API key
const getGeminiKey = async (req) => {
  if (req.cachedGeminiKey) return req.cachedGeminiKey;

  const user = getAuthUser(req);
  if (user && user.id) {
    try {
      const apiKeyRow = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'gemini' } }
      });
      if (apiKeyRow && apiKeyRow.encryptedKey) {
        const decrypted = decryptKey(apiKeyRow.encryptedKey);
        req.cachedGeminiKey = decrypted;
        return decrypted;
      }
    } catch (err) {
      console.error('Error fetching Gemini API key from DB:', err.message);
    }
  }

  return process.env.GEMINI_API_KEY;
};

/**
 * POST /api/voice/command
 * Accepts multipart audio ('file') or 'transcript' string in body,
 * along with optional 'projectId' and 'language_code'.
 */
router.post('/command', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    let { transcript, projectId, language_code } = req.body;
    const langCode = language_code || 'hi-IN';
    const authUser = getAuthUser(req);

    // If a projectId is provided, verify that the authenticated user owns it
    if (projectId && authUser && authUser.id) {
      try {
        await verifyProjectOwnership(projectId, authUser.id);
      } catch (authErr) {
        return res.status(403).json({
          error: 'Access denied: You do not have permission to access or modify this project.',
          code: 'FORBIDDEN'
        });
      }
    }

    const apiKey = await getSarvamKey(req);

    // 1. Get STT transcript if audio provided and no transcript string
    if (!transcript || !transcript.trim()) {
      if (!file) {
        return res.status(400).json({
          error: 'Either audio file or transcript string is required.',
          code: 'INVALID_INPUT'
        });
      }

      if (!apiKey) {
        // Simulator mode fallback
        console.log(`[VoiceCommand Simulator STT] Audio size: ${file.size} bytes`);
        const fallbacks = {
          'hi-IN': 'नमस्ते, मुझे इस प्रोजेक्ट का BRD बनाना है और कॉम्पिटिटर्स रिसर्च करो।',
          'en-IN': 'Hello, create a BRD for this startup and research competitors.',
          'mr-IN': 'नमस्कार, मला या प्रकल्पाचा BRD बनवायचा आहे.'
        };
        transcript = fallbacks[langCode] || fallbacks['en-IN'];
      } else {
        // Production Sarvam STT
        console.log(`[VoiceCommand Production STT] Processing audio via Sarvam Saaras v3`);
        const formData = new FormData();
        formData.append('file', file.buffer, {
          filename: 'command_audio.wav',
          contentType: file.mimetype || 'audio/wav',
        });
        formData.append('model', 'saaras:v3');
        if (langCode && langCode !== 'auto' && langCode !== 'unknown') {
          formData.append('language_code', langCode);
        }

        const sttResponse = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
          headers: {
            'api-subscription-key': apiKey,
            ...formData.getHeaders()
          },
          timeout: 20000
        });
        transcript = sttResponse.data.transcript;
      }
    }

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        error: 'Could not capture transcript from audio. Please try speaking closer to the mic.',
        code: 'STT_EMPTY'
      });
    }

    const apiKeys = {
      sarvamKey: apiKey,
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: await getGeminiKey(req)
    };

    // 2. Classify intent
    const agentType = await identifyAgentIntent(transcript, apiKeys);
    console.log(`[VoiceCommand Router] Prompt: "${transcript}" -> Agent: ${agentType}`);

    let documentId = null;
    let responseTasks = [];
    let spokenConfirmationText = '';

    // 3. Process based on agentType
    if (agentType === 'task_command') {
      const existingTasks = projectId ? await prisma.task.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' }
      }) : [];

      const parsedCmd = await parseTaskCommand(transcript, existingTasks, apiKeys);
      console.log('[VoiceCommand Task Parsing Result]', parsedCmd);

      if (parsedCmd.action === 'assign' && parsedCmd.taskId) {
        if (authUser && authUser.id) {
          await verifyTaskOwnership(parsedCmd.taskId, authUser.id);
        }
        await prisma.task.update({
          where: { id: parsedCmd.taskId },
          data: { assignee: parsedCmd.assignee || null }
        });
        const matched = existingTasks.find(t => t.id === parsedCmd.taskId);
        spokenConfirmationText = `Task '${matched?.title || 'item'}' has been assigned to ${parsedCmd.assignee || 'Unassigned'}.`;
      } else if (parsedCmd.action === 'update_status' && parsedCmd.taskId && parsedCmd.status) {
        if (authUser && authUser.id) {
          await verifyTaskOwnership(parsedCmd.taskId, authUser.id);
        }
        await prisma.task.update({
          where: { id: parsedCmd.taskId },
          data: { status: parsedCmd.status }
        });
        const matched = existingTasks.find(t => t.id === parsedCmd.taskId);
        spokenConfirmationText = `Task '${matched?.title || 'item'}' status updated to ${parsedCmd.status}.`;
      } else if (parsedCmd.action === 'list') {
        if (existingTasks.length > 0) {
          spokenConfirmationText = existingTasks.slice(0, 4).map((t, idx) => 
            `Task ${idx + 1}: ${t.title} (${t.status})`
          ).join('. ');
        } else {
          spokenConfirmationText = "Project mein filhaal koi tasks nahi hain.";
        }
      } else {
        spokenConfirmationText = "Aapka task command samajh nahi aaya. Kripya dubara bolein.";
      }

      responseTasks = projectId ? await prisma.task.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' }
      }) : [];

    } else if (agentType !== 'general') {
      // Document generating agent (BRD, PRD, Roadmap, etc.)
      const workflowRes = await runAgentWorkflow(projectId, agentType, transcript, [], apiKeys);
      documentId = workflowRes.documentId || null;
      responseTasks = workflowRes.tasks || [];
      const taskCount = responseTasks.length;
      const researchNote = workflowRes.metadata?.researchUsed ? ' aur live market research' : '';
      spokenConfirmationText = `Aapka ${agentType.toUpperCase()} document ready hai. Maine ${taskCount} action items${researchNote} add kiye hain.`;
    } else {
      // General conversational fallback
      const chatRes = await getAIResponse({
        prompt: transcript,
        messages: [],
        langCode,
        personality: 'respectful',
        operationType: 'VOICE_RESPONSE',
        ...apiKeys
      });
      spokenConfirmationText = chatRes.response;
    }

    // 4. TTS synthesis for spoken response (short summary < 350 chars)
    let audioContent = null;
    const ttsInputText = (spokenConfirmationText || '').substring(0, 350);

    if (apiKey && ttsInputText) {
      try {
        let defaultSpeaker = 'anushka';
        if (langCode.startsWith('ta')) defaultSpeaker = 'arya';
        else if (langCode.startsWith('en')) defaultSpeaker = 'abhilash';
        else if (langCode.startsWith('mr')) defaultSpeaker = 'manisha';

        const ttsRes = await axios.post('https://api.sarvam.ai/text-to-speech', {
          text: ttsInputText,
          target_language_code: langCode,
          speaker: defaultSpeaker,
          model: 'bulbul:v2',
          speech_sample_rate: 22050,
          enable_preprocessing: true,
          pace: 1.0
        }, {
          headers: {
            'api-subscription-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const sarvamData = ttsRes.data;
        audioContent = sarvamData.audios?.[0] || sarvamData.audio_content || null;
      } catch (ttsErr) {
        console.error('Sarvam TTS Error in VoiceCommand:', ttsErr.message);
      }
    }

    return res.json({
      transcript,
      agentType,
      documentId,
      tasks: responseTasks,
      reply: spokenConfirmationText,
      audio_content: audioContent
    });

  } catch (error) {
    console.error('Voice Command Endpoint Error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Voice command processing failed',
      code: error.code || 'VOICE_COMMAND_FAILED'
    });
  }
});

export default router;
