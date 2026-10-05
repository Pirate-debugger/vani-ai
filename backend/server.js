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
import voiceCommandRoutes from './routes/voiceCommand.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/document.js';
import exportRoutes from './routes/export.js';
import projectRoutes from './routes/project.js';
import taskRoutes from './routes/task.js';
import integrationRoutes from './routes/integration.js';
import customAgentRoutes from './routes/customAgent.js';

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

// API Header Optimizations
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('Content-Security-Policy');
  next();
});

const PORT = process.env.PORT || 5000;

// Rate Limiting — 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: { error: 'Too many requests. Please try again in a minute.', code: 'RATE_LIMITED', retryable: true }
});
app.use('/api/', limiter);

// CORS — explicit allowlist with credentials
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

const envOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin requests (origin === undefined)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api-subscription-key']
}));

// Session Middleware
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
    services: {
      sarvam: Boolean(process.env.SARVAM_API_KEY),
      tinyfish: Boolean(process.env.TINYFISH_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY)
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/voice', voiceCommandRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/document', documentRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/agents', customAgentRoutes);

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

// Global Sanitized Error Handler
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

  // In production, do not return database internals or filesystem paths
  const safeMessage = (status === 500 && process.env.NODE_ENV === 'production')
    ? 'An unexpected server error occurred. Please try again.'
    : err.message || 'Internal Server Error';

  res.status(status).json({
    error: safeMessage,
    code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
    retryable: status >= 500 || status === 429
  });
});

let server = null;
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Vani AI Express Backend Running on:      `);
    console.log(` http://localhost:${PORT}                 `);
    console.log(` Mode: ${process.env.SARVAM_API_KEY ? 'Production (Sarvam API)' : 'Simulator Mode'}`);
    console.log(` TinyFish: ${process.env.TINYFISH_API_KEY ? 'Configured ✓' : 'Not configured'}`);
    console.log(` Gemini: ${process.env.GEMINI_API_KEY ? 'Configured ✓' : 'Not configured'}`);
    console.log(` Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Configured ✓' : 'Not configured (local auth only)'}`);
    console.log(`=========================================`);
  });

  const handleShutdown = () => {
    console.log('\nReceived kill signal, shutting down gracefully...');
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

export default app;
