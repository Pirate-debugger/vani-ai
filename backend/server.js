import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import session from 'express-session';
import passport from 'passport';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import voiceRoutes from './routes/voice.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/document.js';
import exportRoutes from './routes/export.js';
import projectRoutes from './routes/project.js';

dotenv.config();

// ─── Security guard ────────────────────────────────────────────────────────
if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET === 'vani-dev-secret-change-in-prod'
) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production');
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  frameguard: false,
  xXssProtection: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.sarvam.ai", "https://api.openai.com", "https://generativelanguage.googleapis.com", "https://cdn.jsdelivr.net"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'self'"],
    }
  }
}));

// API Header Optimizations to resolve audit warnings (removes unneeded headers and overrides Vercel must-revalidate cache directives)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('Content-Security-Policy');
  next();
});

const PORT = process.env.PORT || 5000;

// Rate Limiting — 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60000,
  max: 60,
  message: { error: 'Too many requests. Please try again in a minute.' }
});
app.use('/api/', limiter);

// CORS — allow frontend origins with credentials
app.use(cors({
  origin: true,
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
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/document', documentRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/projects', projectRoutes);

// Serve frontend build (production only — in dev, Vite runs separately)
const publicDir = path.join(__dirname, 'public');
const indexHtml = path.join(publicDir, 'index.html');

if (existsSync(indexHtml)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.details || null
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Vani AI Express Backend Running on:      `);
    console.log(` http://localhost:${PORT}                 `);
    console.log(` Mode: ${process.env.SARVAM_API_KEY ? 'Production (Sarvam API)' : 'Simulator Mode'}`);
    console.log(` Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Configured ✓' : 'Not configured (local auth only)'}`);
    console.log(`=========================================`);
  });
}

export default app;
