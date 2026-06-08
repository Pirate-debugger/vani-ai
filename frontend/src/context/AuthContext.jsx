import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// SHA-256 hash via browser Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'vani_ai_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const USERS_KEY = 'vani_users';
const CURRENT_USER_KEY = 'vani_current_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);         // null = not logged in (guest)
  const [isGuest, setIsGuest] = useState(false);  // true = explicitly chose guest
  const [authLoading, setAuthLoading] = useState(true);

  // Load persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setIsGuest(parsed.isGuest || false);
      }
    } catch (e) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const getUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const register = useCallback(async ({ name, email, password }) => {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const hashed = await hashPassword(password);
    const newUser = { name, email: email.toLowerCase(), password: hashed };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    const sessionUser = { name, email: email.toLowerCase(), isGuest: false };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    setIsGuest(false);
    return sessionUser;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) throw new Error('No account found with that email address.');
    const hashed = await hashPassword(password);
    if (hashed !== found.password) throw new Error('Incorrect password. Please try again.');

    const sessionUser = { name: found.name, email: found.email, isGuest: false };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    setIsGuest(false);
    return sessionUser;
  }, []);

  const continueAsGuest = useCallback(() => {
    const guestUser = { name: 'Guest', email: null, isGuest: true };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
    setIsGuest(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
    setIsGuest(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isGuest, authLoading, register, login, continueAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
