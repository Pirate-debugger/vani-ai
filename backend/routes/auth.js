import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const router = express.Router();

// Configure Google OAuth strategy (only when credentials are present)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = {
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

// GET /api/auth/google — redirect to Google consent screen
router.get('/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env' });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback — Google redirects here after consent
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?error=auth_failed`,
    session: true
  }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
);

// GET /api/auth/me — returns current logged-in user (Google OAuth or local session)
router.get('/me', (req, res) => {
  if (req.user) return res.json({ user: req.user });
  // Also support local session-based auth from our existing AuthContext
  if (req.session?.localUser) return res.json({ user: req.session.localUser });
  return res.status(401).json({ error: 'Not authenticated' });
});

// POST /api/auth/local-login — local email/password auth (keeps existing auth working)
router.post('/local-login', (req, res) => {
  const { email, name, isGuest } = req.body;
  if (!email && !isGuest) return res.status(400).json({ error: 'Email required' });
  const user = isGuest
    ? { name: 'Guest', email: 'guest@vani.ai', isGuest: true, provider: 'guest' }
    : { name: name || email.split('@')[0], email, provider: 'local' };
  req.session.localUser = user;
  res.json({ user });
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

// POST /api/auth/set-key — store Sarvam API key in session
router.post('/set-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  req.session.sarvamKey = key;
  res.json({ success: true, message: 'API key saved to session.' });
});

// POST /api/auth/clear-key — clear API key from session
router.post('/clear-key', (req, res) => {
  req.session.sarvamKey = null;
  res.json({ success: true });
});

// GET /api/auth/status — check session and key status
router.get('/status', (req, res) => {
  res.json({
    hasKey: !!(req.session?.sarvamKey || process.env.SARVAM_API_KEY),
    source: req.session?.sarvamKey ? 'session' : process.env.SARVAM_API_KEY ? 'env' : 'none',
    user: req.user || req.session?.localUser || null,
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

export default router;
