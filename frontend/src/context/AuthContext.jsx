import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);          // null = not logged in
  const [isGuest, setIsGuest] = useState(false);   // true = guest session
  const [authLoading, setAuthLoading] = useState(true);
  const [guestError, setGuestError] = useState(null);

  // ─── Hydrate session on mount via GET /api/auth/me ────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await apiFetch('/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setIsGuest(data.user?.isGuest ?? false);
        } else {
          setUser(null);
          setIsGuest(false);
        }
      } catch {
        setUser(null);
        setIsGuest(false);
      } finally {
        setAuthLoading(false);
      }
    };
    hydrate();
  }, []);

  // ─── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async ({ name, email, password }) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');

    setUser(data.user);
    setIsGuest(false);
    return data.user;
  }, []);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    setUser(data.user);
    setIsGuest(false);
    return data.user;
  }, []);

  // ─── Guest ─────────────────────────────────────────────────────────────────
  const continueAsGuest = useCallback(async () => {
    setGuestError(null);
    try {
      const res = await apiFetch('/auth/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isGuest: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Guest session initialization failed on server.');
      }
      setUser(data.user);
      setIsGuest(true);
      return data.user;
    } catch (err) {
      console.error('Guest login failed:', err);
      const msg = err.message || 'Unable to establish secure guest session with server. Please try again.';
      setGuestError(msg);
      setUser(null);
      setIsGuest(false);
      throw new Error(msg);
    }
  }, []);

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsGuest(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isGuest, guestError, setGuestError, authLoading, register, login, continueAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
