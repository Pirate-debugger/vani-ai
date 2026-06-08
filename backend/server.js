import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import voiceRoutes from './routes/voice.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Rate Limiting — 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60000,
  max: 60,
  message: { error: 'Too many requests. Please try again in a minute.' }
});
app.use('/api/', limiter);

// CORS — allow frontend origins with credentials
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api-subscription-key']
}));

// Session Middleware (required for passport + Sarvam key storage)
app.use(session({
  secret: process.env.SESSION_SECRET || 'vani-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport OAuth
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    user: req.user || null,
    apiKeysConfigured: {
      sarvam: !!(req.session?.sarvamKey || process.env.SARVAM_API_KEY),
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ai', aiRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.details || null
  });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Vani AI Express Backend Running on:      `);
  console.log(` http://localhost:${PORT}                 `);
  console.log(` Mode: ${process.env.SARVAM_API_KEY ? 'Production (Sarvam API)' : 'Simulator Mode'}`);
  console.log(` Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Configured ✓' : 'Not configured (local auth only)'}`);
  console.log(`=========================================`);
});
