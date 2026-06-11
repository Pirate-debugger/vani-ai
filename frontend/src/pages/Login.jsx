import React, { useState } from 'react';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Backend URL for OAuth redirect (must bypass Vite proxy)
const BACKEND_URL = 'http://localhost:5000';

const Login = ({ onLoginSuccess }) => {
  const { register, login, continueAsGuest } = useAuth();

  const [mode, setMode]               = useState('landing'); // landing | signin | register
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const languages = ['हिन्दी', 'தமிழ்', 'मराठी', 'বাংলা', 'English', 'తెలుగు'];

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setError(''); setShowPassword(false);
  };

  const switchMode = (m) => { resetForm(); setMode(m); };

  // ─── Sign In ──────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login({ email: email.trim(), password });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Register ─────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) { setError('All fields are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await register({ name: name.trim(), email: email.trim(), password });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Guest ────────────────────────────────────────────────────────────────
  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await continueAsGuest();
      if (onLoginSuccess) onLoginSuccess(user);
    } catch {
      setError('Could not start guest session.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared input renderer ────────────────────────────────────────────────
  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyber-cyan/30 transition-all';

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#04020A] relative overflow-hidden select-none">
      <div className="cyber-bg" />

      {/* Animated rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden sm:flex">
        <div className="absolute w-[min(600px,90vw)] h-[min(600px,90vw)] rounded-full border border-cyber-purple/8 animate-spin" style={{ animationDuration: '30s' }} />
        <div className="absolute w-[min(450px,70vw)] h-[min(450px,70vw)] rounded-full border border-cyber-cyan/6 animate-spin" style={{ animationDuration: '20s', animationDirection: 'reverse' }} />
        <div className="absolute w-[min(300px,50vw)] h-[min(300px,50vw)] rounded-full border border-white/4 animate-spin" style={{ animationDuration: '15s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-4 sm:px-6">

        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-cyber-purple/30 to-cyber-cyan/20 border border-cyber-cyan/25 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-glow-neon">
            <Sparkles size={28} className="text-cyber-cyan animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-white via-white to-cyber-cyan bg-clip-text text-transparent tracking-tight">
            Vani AI
          </h1>
          <p className="text-white/40 text-sm mt-2 font-medium tracking-wide">
            Voice-first AI for Bharat
          </p>
        </div>

        {/* Language pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {languages.map(lang => (
            <span key={lang} className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/45 text-xs font-medium">
              {lang}
            </span>
          ))}
        </div>

        {/* Auth card */}
        <div className="w-full glass-panel rounded-2xl p-6 border border-white/8 space-y-3">

          {/* ── Landing ── */}
          {mode === 'landing' && (
            <>
              {/* Google Sign-in */}
              <a
                href={`${BACKEND_URL}/api/auth/google`}
                className="flex items-center justify-center gap-3 w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-95"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <button
                onClick={() => switchMode('signin')}
                className="flex items-center justify-center gap-2.5 w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyber-cyan/25 text-white/70 hover:text-white font-semibold py-3.5 rounded-xl transition-all"
              >
                <Mail size={16} />
                Sign in with Email
              </button>

              <button
                onClick={() => switchMode('register')}
                className="flex items-center justify-center gap-2.5 w-full bg-cyber-cyan/8 hover:bg-cyber-cyan/15 border border-cyber-cyan/20 hover:border-cyber-cyan/40 text-cyber-cyan/80 hover:text-cyber-cyan font-semibold py-3.5 rounded-xl transition-all"
              >
                <User size={16} />
                Create Account
              </button>

              <button
                onClick={handleGuest}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full text-white/35 hover:text-white/60 text-sm font-medium py-2 transition-colors"
              >
                {loading ? <Loader size={14} className="animate-spin" /> : null}
                Continue as Guest (no history saved)
              </button>
            </>
          )}

          {/* ── Sign In ── */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <button type="button" onClick={() => switchMode('landing')} className="text-white/35 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors">
                  ← Back
                </button>
                <span className="text-white/50 text-xs">Sign In</span>
              </div>

              <div>
                <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input id="signin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button type="submit" disabled={loading || !email.trim() || !password}
                className="w-full btn-glow text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
                {loading ? <Loader size={16} className="animate-spin" /> : <><span>Sign In</span><ArrowRight size={16} /></>}
              </button>

              <p className="text-center text-xs text-white/30 pt-1">
                No account?{' '}
                <button type="button" onClick={() => switchMode('register')} className="text-cyber-cyan/70 hover:text-cyber-cyan transition-colors font-medium">
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ── Register ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <button type="button" onClick={() => switchMode('landing')} className="text-white/35 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors">
                  ← Back
                </button>
                <span className="text-white/50 text-xs">Create Account</span>
              </div>

              <div>
                <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input id="register-name" type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name" required autoComplete="name"
                    className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input id="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 font-bold uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" required autoComplete="new-password"
                    className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button type="submit" disabled={loading || !name.trim() || !email.trim() || !password}
                className="w-full btn-glow text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
                {loading ? <Loader size={16} className="animate-spin" /> : <><span>Create Account</span><ArrowRight size={16} /></>}
              </button>

              <p className="text-center text-xs text-white/30 pt-1">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="text-cyber-cyan/70 hover:text-cyber-cyan transition-colors font-medium">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-white/18 text-xs mt-5 text-center leading-relaxed max-w-xs">
          Your voice data is processed privately. We never share or sell your data.
        </p>
      </div>
    </div>
  );
};

export default Login;
