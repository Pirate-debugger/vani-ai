import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import voiceRoutes from './routes/voice.js';
import aiRoutes from './routes/ai.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend accessibility
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api-subscription-key']
}));

// Setup JSON and form-urlencoded body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    apiKeysConfigured: {
      sarvam: !!process.env.SARVAM_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

// Configure base routes
app.use('/api/voice', voiceRoutes);
app.use('/api/ai', aiRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.details || null
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Vani AI Express Backend Running on:      `);
  console.log(` http://localhost:${PORT}                 `);
  console.log(` Mode: ${process.env.SARVAM_API_KEY ? 'Production (Sarvam API)' : 'Simulator Mode (Fallbacks)'}`);
  console.log(`=========================================`);
});
