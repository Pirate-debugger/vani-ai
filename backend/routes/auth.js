import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { encryptKey } from '../lib/crypto.js';
import crypto from 'node:crypto';

const router = express.Router();

const SALT_ROUNDS = 12;

// ─── Google OAuth (unchanged) ──────────────────────────────────────────────

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value || '',
        avatar: profile.photos?.[0]?.value || '',
        provider: 'google',
      };
      return done(null, user);
    }
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// GET /api/auth/google
router.get('/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env' });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback
router.get('/google/callback',
  (req, res, next) => {
    const frontendUrl = process.env.VERCEL ? '/' : (process.env.FRONTEND_URL || 'http://localhost:5173');
    req.frontendUrl = frontendUrl;
    next();
  },
  (req, res, next) => {
    passport.authenticate('google', {
      failureRedirect: `${req.frontendUrl}?error=auth_failed`,
      session: true
    })(req, res, next);
  },
  (req, res) => {
    res.redirect(req.frontendUrl);
  }
);

// ─── Local Auth — Register ─────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    const sessionUser = { id: user.id, name: user.name, email: user.email, provider: 'local', isGuest: false };
    req.session.localUser = sessionUser;

    return res.status(201).json({ user: sessionUser });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── Local Auth — Login ────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'No account found with that email address.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const sessionUser = { id: user.id, name: user.name, email: user.email, provider: 'local', isGuest: false };
    req.session.localUser = sessionUser;

    return res.json({ user: sessionUser });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── Session / Me / Logout ────────────────────────────────────────────────

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.user) return res.json({ user: req.user });
  if (req.session?.localUser) return res.json({ user: req.session.localUser });
  return res.status(401).json({ error: 'Not authenticated' });
});

// POST /api/auth/logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// ─── Guest / Legacy Local Login (kept for backward compatibility) ──────────

// POST /api/auth/local-login
router.post('/local-login', (req, res) => {
  const { email, name, isGuest } = req.body;
  if (!email && !isGuest) return res.status(400).json({ error: 'Email required' });
  const user = isGuest
    ? { name: 'Guest', email: 'guest@vani.ai', isGuest: true, provider: 'guest' }
    : { name: name || email.split('@')[0], email, provider: 'local' };
  req.session.localUser = user;
  res.json({ user });
});

// ─── API Key management (database-backed) ───────────────────────────────────

const requireAuth = (req, res, next) => {
  const user = req.user || req.session?.localUser;
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.authUser = user;
  next();
};

// POST /api/auth/set-key
router.post('/set-key', requireAuth, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  
  try {
    const encryptedKey = encryptKey(key);
    await prisma.apiKey.upsert({
      where: {
        userId_provider: {
          userId: req.authUser.id,
          provider: 'sarvam'
        }
      },
      update: { encryptedKey },
      create: {
        userId: req.authUser.id,
        provider: 'sarvam',
        encryptedKey
      }
    });
    res.json({ success: true, message: 'API key saved securely.' });
  } catch (err) {
    console.error('Save key error:', err);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// POST /api/auth/clear-key
router.post('/clear-key', requireAuth, async (req, res) => {
  try {
    await prisma.apiKey.deleteMany({
      where: {
        userId: req.authUser.id,
        provider: 'sarvam'
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Clear key error:', err);
    res.status(500).json({ error: 'Failed to clear API key' });
  }
});

// GET /api/auth/status
router.get('/status', async (req, res) => {
  const user = req.user || req.session?.localUser;
  let hasDbKey = false;
  
  if (user && user.id) {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: {
          userId_provider: {
            userId: user.id,
            provider: 'sarvam'
          }
        }
      });
      hasDbKey = !!apiKey;
    } catch (err) {
      console.error('Status check error:', err);
    }
  }

  res.json({
    hasKey: !!(hasDbKey || process.env.SARVAM_API_KEY),
    source: hasDbKey ? 'session' : process.env.SARVAM_API_KEY ? 'env' : 'none',
    user: user || null,
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// ─── Password Reset ─────────────────────────────────────────────────────────

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return generic success to prevent email enumeration
    return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }

  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiry = new Date(Date.now() + 3600000); // 1 hour

  await prisma.user.update({
    where: { email },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: expiry
    }
  });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${email}`;
  
  // Since there's no email service configured, we log it to the server console for now
  console.log('===================================================');
  console.log('PASSWORD RESET LINK REQUESTED:');
  console.log(resetUrl);
  console.log('===================================================');

  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, email, newPassword } = req.body;
  if (!token || !email || !newPassword) return res.status(400).json({ error: 'Missing required fields' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const user = await prisma.user.findFirst({
    where: {
      email,
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: newPasswordHash,
      resetToken: null,
      resetTokenExpiry: null
    }
  });

  res.json({ message: 'Password has been successfully reset' });
});

export default router;
