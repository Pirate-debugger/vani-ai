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

export const ChatHistoryProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const isGuest = user?.isGuest || false;
  const [sessions, setSessions] = useState([]);          // list of { id, title, createdAt, lang, messages }
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const isLoggedIn = !!user && !isGuest && !loading;

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

  // Persist sessions to localStorage whenever they change
  const persistSessions = useCallback((newSessions) => {
    if (!isLoggedIn || !user?.email) return;
    localStorage.setItem(SESSION_KEY(user.email), JSON.stringify(newSessions));
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
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages,
          lang: lang || s.lang,
          title: generateTitle(messages) || s.title,
        };
      });
      // If session doesn't exist yet, create it
      if (!prev.find(s => s.id === sessionId)) {
        const newSession = {
          id: sessionId,
          title: generateTitle(messages) || 'New Conversation',
          createdAt: new Date().toISOString(),
          lang: lang || 'hi-IN',
          messages
        };
        const withNew = [newSession, ...prev];
        persistSessions(withNew);
        return withNew;
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

  return (
    <ChatHistoryContext.Provider value={{
      sessions,
      currentSessionId,
      setCurrentSessionId,
      startNewSession,
      saveSession,
      loadSession,
      deleteSession,
      getCurrentSession,
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
