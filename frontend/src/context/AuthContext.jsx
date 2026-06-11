import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);          // null = not logged in
  const [isGuest, setIsGuest] = useState(false);   // true = guest session
  const [authLoading, setAuthLoading] = useState(true);

  // ─── Hydrate session on mount via GET /api/auth/me ────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
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
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
    try {
      const res = await fetch(`${API_BASE}/auth/local-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isGuest: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsGuest(true);
        return data.user;
      }
    } catch (err) {
      console.error('Guest login failed:', err);
    }
    // Fallback: set a client-side guest if backend unreachable
    const guestUser = { name: 'Guest', email: null, isGuest: true, provider: 'guest' };
    setUser(guestUser);
    setIsGuest(true);
    return guestUser;
  }, []);

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsGuest(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isGuest, authLoading, register, login, continueAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
