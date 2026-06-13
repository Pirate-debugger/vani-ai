import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

const ChatHistoryContext = createContext(null);

const SESSION_KEY = (email) => `vani_sessions_${email}`;

// Generate a short title from the first user message
function generateTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New Conversation';
  const words = firstUser.content.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.length < firstUser.content.trim().length ? words + '…' : words;
}

function genId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

const MAX_SESSIONS = 100;
const MAX_MESSAGES_PER_SESSION = 200;

export const ChatHistoryProvider = ({ children }) => {
  const { user, authLoading } = useAuth();
  const isGuest = user?.isGuest || false;
  const [sessions, setSessions] = useState([]);          // list of { id, title, createdAt, lang, messages }
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const persistTimerRef = React.useRef(null);

  const isLoggedIn = !!user && !isGuest && !authLoading;

  // Load sessions from localStorage when user changes
  useEffect(() => {
    if (!isLoggedIn) {
      setSessions([]);
      setCurrentSessionId(null);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY(user.email)) || '[]');
      setSessions(stored);
    } catch {
      setSessions([]);
    }
  }, [user, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist sessions to localStorage whenever they change (debounced to avoid quota & performance issues)
  const persistSessions = useCallback((newSessions) => {
    if (!isLoggedIn || !user?.email) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(SESSION_KEY(user.email), JSON.stringify(newSessions));
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          // Drop the oldest half of sessions and retry
          const trimmed = newSessions.slice(0, Math.floor(newSessions.length / 2));
          try {
            localStorage.setItem(SESSION_KEY(user.email), JSON.stringify(trimmed));
            console.warn('localStorage quota exceeded — trimmed sessions to', trimmed.length);
          } catch (e2) {
            console.error('Failed to save even after trimming', e2);
          }
        }
      }
    }, 2000);
  }, [isLoggedIn, user]);

  // Start a new chat session — returns new sessionId
  const startNewSession = useCallback((lang = 'hi-IN') => {
    if (!isLoggedIn) return null;
    const id = genId();
    const newSession = {
      id,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      lang,
      messages: []
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      persistSessions(updated);
      return updated;
    });
    setCurrentSessionId(id);
    return id;
  }, [isLoggedIn, persistSessions]);

  // Save/update messages for the current session
  const saveSession = useCallback((sessionId, messages, lang) => {
    if (!isLoggedIn || !sessionId) return;
    
    // Trim messages to prevent exceeding quotas
    const trimmedMessages = messages.length > MAX_MESSAGES_PER_SESSION 
      ? messages.slice(messages.length - MAX_MESSAGES_PER_SESSION) 
      : messages;

    setSessions(prev => {
      let updated = prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: trimmedMessages,
          lang: lang || s.lang,
          title: generateTitle(trimmedMessages) || s.title,
        };
      });
      // If session doesn't exist yet, create it
      if (!prev.find(s => s.id === sessionId)) {
        const newSession = {
          id: sessionId,
          title: generateTitle(trimmedMessages) || 'New Conversation',
          createdAt: new Date().toISOString(),
          lang: lang || 'hi-IN',
          messages: trimmedMessages
        };
        updated = [newSession, ...prev];
      }
      
      // Enforce session limit
      if (updated.length > MAX_SESSIONS) {
        updated = updated.slice(0, MAX_SESSIONS);
      }
      
      persistSessions(updated);
      return updated;
    });
  }, [isLoggedIn, persistSessions]);

  // Load an existing session into active view — returns its messages
  const loadSession = useCallback((sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    setCurrentSessionId(sessionId);
    return session;
  }, [sessions]);

  // Delete a session
  const deleteSession = useCallback((sessionId) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      persistSessions(updated);
      return updated;
    });
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId, persistSessions]);

  // Get messages for current session
  const getCurrentSession = useCallback(() => {
    if (!currentSessionId) return null;
    return sessions.find(s => s.id === currentSessionId) || null;
  }, [currentSessionId, sessions]);

  // Get storage usage (returns string formatted as KB)
  const getStorageUsage = useCallback(() => {
    if (!isLoggedIn || !user?.email) return '0.00';
    const data = localStorage.getItem(SESSION_KEY(user.email)) || '';
    return (new Blob([data]).size / 1024).toFixed(2);
  }, [isLoggedIn, user]);

  // Delete all sessions
  const deleteAllSessions = useCallback(() => {
    if (!isLoggedIn || !user?.email) return;
    localStorage.removeItem(SESSION_KEY(user.email));
    setSessions([]);
    setCurrentSessionId(null);
  }, [isLoggedIn, user]);

  return (
    <ChatHistoryContext.Provider value={{
      sessions,
      currentSessionId,
      setCurrentSessionId,
      startNewSession,
      saveSession,
      loadSession,
      deleteSession,
      deleteAllSessions,
      getCurrentSession,
      getStorageUsage,
      isLoggedIn
    }}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error('useChatHistory must be used inside ChatHistoryProvider');
  return ctx;
};
