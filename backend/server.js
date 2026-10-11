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
import prisma from './lib/prisma.js';
import { PrismaSessionStore } from './lib/sessionStore.js';
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
import scheduleRoutes from './routes/schedule.js';
import { startSchedulerDaemon } from './services/schedulerService.js';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
import logger from './lib/logger.js';

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
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'self'"],
    }
  }
}));

// API Header Optimizations (CSP preserved for /api)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
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

// Strict Rate Limiting for Auth routes (20 attempts per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again later.', code: 'AUTH_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api-subscription-key', 'X-Requested-With', 'X-Vani-Client']
}));

// CSRF validation for state-changing API endpoints
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin) && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
      return res.status(403).json({ error: 'Cross-site request blocked', code: 'CSRF_BLOCKED' });
    }
  }
  next();
});

// Session Middleware — persistent Prisma store with memory fallback for test environments
const sessionStore = (process.env.NODE_ENV === 'test' || !prisma?.session)
  ? undefined
  : new PrismaSessionStore();

app.use(session({
  store: sessionStore,
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

app.use(pinoHttp({
  logger,
  autoLogging: process.env.NODE_ENV !== 'test',
  genReqId: (req) => req.headers['x-request-id'] || req.headers['x-correlation-id'] || crypto.randomUUID()
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check Endpoints (Phase 2 Observability)
// 1. Liveness probe: verifies process is alive and responsive
app.get('/api/health/live', (req, res) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Readiness probe: verifies database connection & external services
app.get('/api/health/ready', async (req, res) => {
  try {
    // Verify database connectivity
    await prisma.user.findFirst({ select: { id: true } });
    res.json({
      status: 'ready',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        sarvam: Boolean(process.env.SARVAM_API_KEY),
        tinyfish: Boolean(process.env.TINYFISH_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY)
      }
    });
  } catch (dbErr) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: dbErr.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 3. General Health Check (Backward-compatible)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      sarvam: Boolean(process.env.SARVAM_API_KEY),
      tinyfish: Boolean(process.env.TINYFISH_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY)
    }
  });
});

// 4. Sanitized Provider Diagnostics Check (no keys exposed)
app.get('/api/health/providers', (req, res) => {
  res.json({
    status: 'ok',
    providers: {
      sarvam: { configured: Boolean(process.env.SARVAM_API_KEY) },
      tinyfish: { configured: Boolean(process.env.TINYFISH_API_KEY) },
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) }
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
app.use('/api/schedule', scheduleRoutes);
app.use('/api/schedules', scheduleRoutes);

// Catch-all for undefined API routes — always return JSON 404, never index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
    retryable: false
  });
});

// Serve frontend build (production only — in dev, Vite runs separately)
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
const backendPublicDir = path.join(__dirname, 'public');
const resolvedStaticDir = existsSync(path.join(frontendDistDir, 'index.html'))
  ? frontendDistDir
  : existsSync(path.join(backendPublicDir, 'index.html'))
    ? backendPublicDir
    : null;

if (resolvedStaticDir) {
  app.use(express.static(resolvedStaticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(resolvedStaticDir, 'index.html'));
  });
}

// Global Sanitized Error Handler
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  logger.error({ reqId: req.id, method: req.method, url: req.originalUrl, err: err.message }, 'API Error');

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
    startSchedulerDaemon();
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
