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
      try {
        const email = profile.emails?.[0]?.value?.trim().toLowerCase() || `${profile.id}@google.user`;
        const name = profile.displayName || 'Google User';
        const avatar = profile.photos?.[0]?.value || '';

        // Upsert real User row in database (Phase 1, Item 7)
        let dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: profile.id },
              { email }
            ]
          }
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              googleId: profile.id,
              name,
              email,
              passwordHash: 'oauth_managed',
            }
          });
        } else if (!dbUser.googleId) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { googleId: profile.id }
          });
        }

        const user = {
          id: dbUser.id,
          googleId: profile.id,
          name: dbUser.name,
          email: dbUser.email,
          avatar,
          provider: 'google',
        };
        return done(null, user);
      } catch (err) {
        console.error('Google OAuth user sync error:', err);
        return done(err, null);
      }
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
    return res.status(400).json({ error: 'Name, email, and password are required.', code: 'INVALID_INPUT' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email format.', code: 'INVALID_EMAIL' });
  }

  // Password policy: min 10 characters (Phase 1, Item 6)
  if (password.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters long.', code: 'WEAK_PASSWORD' });
  }

  const commonPasswords = ['password123', '1234567890', 'qwertyuiop', 'admin12345', 'password1234'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return res.status(400).json({ error: 'Password is too common and insecure. Please choose a stronger password.', code: 'WEAK_PASSWORD' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
      },
    });

    const sessionUser = { id: user.id, name: user.name, email: user.email, provider: 'local', isGuest: false };
    
    // Rotate session ID on registration
    if (req.session && typeof req.session.regenerate === 'function') {
      req.session.regenerate((err) => {
        if (err) console.warn('[Session] Session regenerate error:', err.message);
        req.session.localUser = sessionUser;
        return res.status(201).json({ user: sessionUser });
      });
    } else {
      req.session.localUser = sessionUser;
      return res.status(201).json({ user: sessionUser });
    }
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.', code: 'REGISTRATION_FAILED' });
  }
});

// ─── Local Auth — Login ────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.', code: 'INVALID_INPUT' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    // Generic error to prevent email enumeration (Phase 1, Item 6)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    const sessionUser = { id: user.id, name: user.name, email: user.email, provider: 'local', isGuest: false };

    // Rotate session ID on login to prevent session fixation attacks
    if (req.session && typeof req.session.regenerate === 'function') {
      req.session.regenerate((err) => {
        if (err) console.warn('[Session] Session regenerate error on login:', err.message);
        req.session.localUser = sessionUser;
        return res.json({ user: sessionUser });
      });
    } else {
      req.session.localUser = sessionUser;
      return res.json({ user: sessionUser });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.', code: 'LOGIN_FAILED' });
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

// ─── Guest / Legacy Local Login ───────────────────────────────────────────

// POST /api/auth/local-login
router.post('/local-login', async (req, res) => {
  try {
    const { email, name, isGuest } = req.body;

    // Passwordless account takeover prevention (Phase 1, Item 1)
    if (!isGuest) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'Passwordless local login is disabled in production. Please use /api/auth/login or continue as guest.',
          code: 'PASSWORDLESS_LOGIN_FORBIDDEN'
        });
      }
      if (!email) return res.status(400).json({ error: 'Email required', code: 'INVALID_INPUT' });
    }

    let finalId;
    let userEmail;
    let userName;

    if (isGuest) {
      // If current session already has an isolated guest ID, reuse it
      if (req.session?.localUser?.isGuest && req.session?.localUser?.id) {
        finalId = req.session.localUser.id;
        userEmail = req.session.localUser.email;
        userName = name || req.session.localUser.name || 'Guest User';
      } else {
        const guestHex = crypto.randomBytes(6).toString('hex');
        finalId = `guest_${Date.now()}_${guestHex}`;
        userEmail = `${finalId}@guest.vani.ai`;
        userName = name || 'Guest User';
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiry

        try {
          await prisma.user.create({
            data: {
              id: finalId,
              email: userEmail,
              name: userName,
              passwordHash: 'guest_ephemeral',
              expiresAt
            }
          });
        } catch (dbErr) {
          console.warn('[Auth Local Login] Guest user create warn:', dbErr.message);
        }
      }
    } else {
      userEmail = email.toLowerCase().trim();
      userName = name?.trim() || userEmail.split('@')[0];

      try {
        let dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: userEmail,
              name: userName,
              passwordHash: 'local_legacy'
            }
          });
        }
        finalId = dbUser?.id || userEmail.replace(/[^a-zA-Z0-9_]/g, '_');
      } catch (dbErr) {
        console.warn('[Auth Local Login] User fetch/create warn:', dbErr.message);
        finalId = userEmail.replace(/[^a-zA-Z0-9_]/g, '_');
      }
    }

    const user = {
      id: finalId,
      name: userName,
      email: userEmail,
      isGuest: Boolean(isGuest),
      provider: isGuest ? 'guest' : 'local'
    };
    req.session.localUser = user;
    res.json({ user });
  } catch (err) {
    console.error('[Auth Local Login Error]:', err.message);
    res.status(500).json({ error: 'Local login initialization failed', code: 'LOCAL_LOGIN_FAILED' });
  }
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
  const { key, provider = 'sarvam' } = req.body;
  if (!key || typeof key !== 'string' || !key.trim()) {
    return res.status(400).json({ error: 'Valid API key is required', code: 'INVALID_INPUT' });
  }

  const validProviders = ['sarvam', 'openai', 'gemini', 'tinyfish'];
  const targetProvider = validProviders.includes(provider.toLowerCase()) ? provider.toLowerCase() : 'sarvam';
  
  try {
    const encryptedKey = encryptKey(key.trim());
    await prisma.apiKey.upsert({
      where: {
        userId_provider: {
          userId: req.authUser.id,
          provider: targetProvider
        }
      },
      update: { encryptedKey },
      create: {
        userId: req.authUser.id,
        provider: targetProvider,
        encryptedKey
      }
    });

    const trimmed = key.trim();
    const masked = trimmed.length > 8
      ? `${trimmed.substring(0, 4)}••••${trimmed.substring(trimmed.length - 4)}`
      : '••••••••';

    // Structured Audit Log (Phase 1, Item 12)
    console.log(JSON.stringify({
      audit: true,
      event: 'API_KEY_SET',
      userId: req.authUser.id,
      provider: targetProvider,
      timestamp: new Date().toISOString()
    }));

    res.json({ 
      success: true, 
      message: `${targetProvider.toUpperCase()} key configured successfully.`, 
      provider: targetProvider,
      masked
    });
  } catch (err) {
    console.error('Save key error:', err);
    res.status(500).json({ error: 'Failed to save API key securely', code: 'KEY_SAVE_FAILED' });
  }
});

// POST /api/auth/clear-key
router.post('/clear-key', requireAuth, async (req, res) => {
  const { provider = 'sarvam' } = req.body;
  const validProviders = ['sarvam', 'openai', 'gemini', 'tinyfish'];
  const targetProvider = validProviders.includes(provider.toLowerCase()) ? provider.toLowerCase() : 'sarvam';

  try {
    await prisma.apiKey.deleteMany({
      where: {
        userId: req.authUser.id,
        provider: targetProvider
      }
    });

    // Structured Audit Log (Phase 1, Item 12)
    console.log(JSON.stringify({
      audit: true,
      event: 'API_KEY_CLEARED',
      userId: req.authUser.id,
      provider: targetProvider,
      timestamp: new Date().toISOString()
    }));

    res.json({ success: true, provider: targetProvider });
  } catch (err) {
    console.error('Clear key error:', err);
    res.status(500).json({ error: 'Failed to clear API key', code: 'KEY_CLEAR_FAILED' });
  }
});

// GET /api/auth/status
router.get('/status', async (req, res) => {
  const user = req.user || req.session?.localUser;
  
  const mask = (key) => {
    if (!key || typeof key !== 'string') return null;
    const str = key.trim();
    if (str.length <= 8) return '••••••••';
    return `${str.substring(0, 4)}••••${str.substring(str.length - 4)}`;
  };

  const providersStatus = {
    sarvam: { 
      status: process.env.SARVAM_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: Boolean(process.env.SARVAM_API_KEY), 
      source: process.env.SARVAM_API_KEY ? 'env' : 'none',
      masked: mask(process.env.SARVAM_API_KEY)
    },
    openai: { 
      status: process.env.OPENAI_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: Boolean(process.env.OPENAI_API_KEY), 
      source: process.env.OPENAI_API_KEY ? 'env' : 'none',
      masked: mask(process.env.OPENAI_API_KEY)
    },
    gemini: { 
      status: process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: Boolean(process.env.GEMINI_API_KEY), 
      source: process.env.GEMINI_API_KEY ? 'env' : 'none',
      masked: mask(process.env.GEMINI_API_KEY)
    },
    tinyfish: { 
      status: process.env.TINYFISH_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: Boolean(process.env.TINYFISH_API_KEY), 
      source: process.env.TINYFISH_API_KEY ? 'env' : 'none',
      masked: mask(process.env.TINYFISH_API_KEY)
    }
  };
  
  if (user && user.id) {
    try {
      const dbKeys = await prisma.apiKey.findMany({
        where: { userId: user.id }
      });
      for (const k of dbKeys) {
        if (providersStatus[k.provider]) {
          let maskedVal = '••••••••';
          try {
            const dec = decryptKey(k.encryptedKey);
            maskedVal = mask(dec);
          } catch (e) {}

          providersStatus[k.provider] = { 
            status: 'CONFIGURED',
            configured: true, 
            source: 'db',
            masked: maskedVal
          };
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
  }

  const sarvamConfigured = providersStatus.sarvam.configured;

  res.json({
    hasKey: sarvamConfigured,
    source: providersStatus.sarvam.source,
    providers: providersStatus,
    user: user || null,
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// ─── Password Reset ─────────────────────────────────────────────────────────

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required', code: 'INVALID_INPUT' });

  const cleanEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) {
    // Return generic success to prevent email enumeration
    return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }

  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiry = new Date(Date.now() + 3600000); // 1 hour

  await prisma.user.update({
    where: { email: cleanEmail },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: expiry
    }
  });

  // URL-encode reset links (Phase 1, Item 6)
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(cleanEmail)}`;
  
  console.log('===================================================');
  console.log('PASSWORD RESET LINK REQUESTED:');
  console.log(resetUrl);
  console.log('===================================================');

  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, email, newPassword } = req.body;
  if (!token || !email || !newPassword) return res.status(400).json({ error: 'Missing required fields', code: 'INVALID_INPUT' });

  const cleanEmail = email.trim().toLowerCase();

  // Password policy: min 10 characters (Phase 1, Item 6)
  if (newPassword.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters long.', code: 'WEAK_PASSWORD' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const user = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token', code: 'INVALID_TOKEN' });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { email: cleanEmail },
    data: {
      passwordHash: newPasswordHash,
      resetToken: null,
      resetTokenExpiry: null
    }
  });

  // Invalidate current session on password reset
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => {});
  }

  res.json({ message: 'Password has been successfully reset' });
});

export default router;
