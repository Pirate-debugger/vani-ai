import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader, Eye, EyeOff, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : window.location.origin;

const Login = ({ onLoginSuccess }) => {
  const { register, login, continueAsGuest } = useAuth();

  const [mode, setMode]               = useState('landing'); // landing | signin | register | forgot-password | reset-password
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [successMsg, setSuccessMsg]   = useState('');

  // Check URL for reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const urlEmail = params.get('email');
    if (token && urlEmail) {
      setResetToken(token);
      setEmail(urlEmail);
      setMode('reset-password');
    }
    // Check for auth errors from Google OAuth
    if (params.get('error') === 'auth_failed') {
      setError('Google Authentication failed. Please try again.');
    }
  }, []);

  const resetForm = () => {
    setName(''); setPassword(''); setError(''); setSuccessMsg(''); setShowPassword(false);
  };

  const switchMode = (m) => { resetForm(); setMode(m); };

  // ─── Sign In ──────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
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
    setLoading(true); setError('');
    try {
      const user = await register({ name: name.trim(), email: email.trim(), password });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password ──────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email: email.trim() });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset Password ───────────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/reset-password`, { 
        token: resetToken, 
        email: email.trim(), 
        newPassword: password 
      });
      setSuccessMsg(res.data.message);
      setTimeout(() => switchMode('signin'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Guest Login ──────────────────────────────────────────────────────────
  const handleGuest = async () => {
    setLoading(true); setError('');
    try {
      const user = await continueAsGuest();
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

  // ─── UI Components ────────────────────────────────────────────────────────
  const renderInput = (icon, type, placeholder, value, setValue, autoFocus = false) => (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-cyan-400 transition-colors">
        {icon}
      </div>
      <input
        type={type === 'password' && showPassword ? 'text' : type}
        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all shadow-inner"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        required
      />
      {type === 'password' && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors focus:outline-none"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#04020A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="cyber-bg opacity-30 absolute inset-0 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 perspective-1000">
        
        {/* Brand Header */}
        <div className="text-center mb-8 transform hover:scale-105 transition-transform duration-500">
          <div className="inline-flex items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.15)] mb-4 backdrop-blur-md">
            <Sparkles className="text-cyan-400 w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 tracking-tight">
            Vani AI
          </h1>
          <p className="text-white/50 mt-2 font-medium tracking-wide">
            Your Multilingual Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <p className="text-emerald-400 text-sm font-medium">{successMsg}</p>
            </div>
          )}

          {/* ─── LANDING MODE ─── */}
          {mode === 'landing' && (
            <div className="space-y-4 animate-in zoom-in-95 duration-300">
              <button
                onClick={() => switchMode('signin')}
                className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Sign In <ArrowRight size={18} />
              </button>
              
              <button
                onClick={() => switchMode('register')}
                className="w-full py-4 rounded-xl font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Create Account
              </button>

              <div className="relative py-4 flex items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/30 text-sm font-medium">OR</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <a
                href={`${BACKEND_URL}/api/auth/google`}
                className="w-full py-4 rounded-xl font-semibold bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </a>

              <button
                onClick={handleGuest}
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold bg-transparent text-white/50 hover:text-white transition-colors flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader className="animate-spin" size={18} /> : (
                  <>Continue as Guest <ArrowRight size={16} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" /></>
                )}
              </button>
            </div>
          )}

          {/* ─── SIGN IN MODE ─── */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-5 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>
              {renderInput(<Mail size={18} />, 'email', 'Email address', email, setEmail, true)}
              <div>
                {renderInput(<Lock size={18} />, 'password', 'Password', password, setPassword)}
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={() => switchMode('forgot-password')} className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                    Forgot Password?
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-50 disabled:hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : 'Sign In'}
              </button>
              <button type="button" onClick={() => switchMode('landing')} className="w-full py-3 text-sm font-medium text-white/40 hover:text-white transition-colors">
                ← Back to options
              </button>
            </form>
          )}

          {/* ─── REGISTER MODE ─── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>
              {renderInput(<User size={18} />, 'text', 'Full Name', name, setName, true)}
              {renderInput(<Mail size={18} />, 'email', 'Email address', email, setEmail)}
              {renderInput(<Lock size={18} />, 'password', 'Password', password, setPassword)}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl font-bold bg-white text-black hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : 'Create Account'}
              </button>
              <button type="button" onClick={() => switchMode('landing')} className="w-full py-3 text-sm font-medium text-white/40 hover:text-white transition-colors">
                ← Back to options
              </button>
            </form>
          )}

          {/* ─── FORGOT PASSWORD MODE ─── */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-5 animate-in slide-in-from-right-8 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-white/50 text-sm leading-relaxed">Enter your email address and we'll send you a link to reset your password securely.</p>
              </div>
              {renderInput(<Mail size={18} />, 'email', 'Email address', email, setEmail, true)}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => switchMode('signin')} className="w-full py-3 text-sm font-medium text-white/40 hover:text-white transition-colors">
                ← Back to sign in
              </button>
            </form>
          )}

          {/* ─── RESET PASSWORD MODE ─── */}
          {mode === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="space-y-5 animate-in slide-in-from-bottom-8 duration-500">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <KeyRound className="text-emerald-400 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Create New Password</h2>
                <p className="text-white/50 text-sm">Enter your new strong password below.</p>
              </div>
              
              {renderInput(<Lock size={18} />, 'password', 'New Password', password, setPassword, true)}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : 'Save New Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-300">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
            Powered by Sarvam AI & Open Source
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
