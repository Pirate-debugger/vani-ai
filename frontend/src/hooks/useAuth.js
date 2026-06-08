import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * useAuth — fetches current user from backend session.
 * Works with both Google OAuth and local email auth.
 */
export const useAuth = () => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      setUser(null);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/local-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isGuest: true })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Guest login failed:', err);
    }
  }, []);

  const loginLocal = useCallback(async (email, name) => {
    try {
      const res = await fetch(`${API_BASE}/auth/local-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, name })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Local login failed:', err);
    }
    return null;
  }, []);

  return { user, loading, logout, loginAsGuest, loginLocal };
};
