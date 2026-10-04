import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ChatHistoryProvider, useChatHistory } from './context/ChatHistoryContext';
import Sidebar from './components/Sidebar';
import Workspace from './pages/Workspace';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Assistant from './pages/Assistant';
import Settings from './pages/Settings';
import Login from './pages/Login';
import WhyVani from './pages/WhyVani';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import MicPermissionModal from './components/MicPermissionModal';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { Sparkles, X } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

// Simulator Mode Banner
const SimulatorBanner = () => (
  <div className="w-full px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/15 text-center flex items-center justify-center gap-2 flex-shrink-0 z-20">
    <span className="text-amber-400 text-[11px] font-bold tracking-wide uppercase">
      ⚠ Simulator Mode — Add your Sarvam API key in Settings for real AI
    </span>
  </div>
);

const OfflineBanner = ({ onDismiss }) => (
  <div className="w-full px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/15 text-center flex items-center justify-between gap-2 flex-shrink-0 z-20">
    <span className="text-amber-400 text-[11px] font-bold tracking-wide uppercase flex-1">
      ⚠ Backend offline — running in demo mode
    </span>
    <button onClick={onDismiss} className="text-amber-400/60 hover:text-amber-400" title="Dismiss offline banner" aria-label="Dismiss offline banner">
      <X size={14} />
    </button>
  </div>
);

const AppInner = () => {
  const { user, setUser, authLoading: loading, logout } = useAuth();
  const chatHistory = useChatHistory();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from path for sidebar highlighting
  const activeTab = location.pathname.startsWith('/dashboard') ? 'dashboard' 
                  : location.pathname.startsWith('/chat') ? 'chat'
                  : location.pathname.startsWith('/assistant') ? 'assistant'
                  : location.pathname.startsWith('/settings') ? 'settings'
                  : location.pathname.startsWith('/why-vani') ? 'why-vani'
                  : 'home';
  const [currentLang, setCurrentLang]     = useState('hi-IN');
  const [personality, setPersonality]     = useState('respectful');
  const [voiceSpeed, setVoiceSpeed]       = useState(1.0);
  const [apiKey, setApiKey]               = useState('');
  const [messages, setMessages]           = useState([]);
  const [isSimulatorMode, setIsSimulatorMode] = useState(false);
  const [micPrompted, setMicPrompted]     = useState(() => localStorage.getItem('vani_mic_prompted') === 'true');
  const [backendOffline, setBackendOffline] = useState(false);
  const [dismissOffline, setDismissOffline] = useState(false);
  const [accessibilityMode, setAccessibilityMode] = useState(() => localStorage.getItem('vani_accessibility') === 'true');

  const voiceRecorder = useVoiceRecorder(currentLang);

  // Helper getters from localStorage
  const getProfile     = () => { try { return JSON.parse(localStorage.getItem('vani_profile') || 'null'); } catch { return null; } };
  const getSaveHistory = () => localStorage.getItem('vani_save_history') !== 'false';
  const getAutoSpeak   = () => localStorage.getItem('vani_autospeak') !== 'false';
  const getSpeaker     = () => localStorage.getItem('vani_speaker') || 'priya';

  // Restore chat session from sidebar
  const handleLoadSession = useCallback((sessionMessages, sessionLang, newSessionId) => {
    setMessages(sessionMessages || []);
    if (sessionLang) setCurrentLang(sessionLang);
    navigate('/');
    if (newSessionId && chatHistory.isLoggedIn) chatHistory.setCurrentSessionId(newSessionId);
  }, [chatHistory]);

  // Auto-save messages to history
  useEffect(() => {
    if (!chatHistory.isLoggedIn || messages.length === 0) return;
    if (!getSaveHistory()) return;
    if (!chatHistory.currentSessionId) {
      const id = chatHistory.startNewSession(currentLang);
      if (id) chatHistory.saveSession(id, messages, currentLang);
    } else {
      chatHistory.saveSession(chatHistory.currentSessionId, messages, currentLang);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get('/api/health', { timeout: 3000 });
        setBackendOffline(false);
      } catch {
        setBackendOffline(true);
        setDismissOffline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMicAllow = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Mic access denied:', err);
    } finally {
      localStorage.setItem('vani_mic_prompted', 'true');
      setMicPrompted(true);
    }
  };

  const handleMicDismiss = () => {
    localStorage.setItem('vani_mic_prompted', 'true');
    setMicPrompted(true);
  };

  // Cancel speech on tab change
  useEffect(() => {
    voiceRecorder.cancelSpeech?.();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Global keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (voiceRecorder.isRecording) voiceRecorder.stopRecording();
        else voiceRecorder.startRecording();
      }
      if (e.code === 'Escape') voiceRecorder.cancelSpeech?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [voiceRecorder]);

  const onSubmitPrompt = async (promptText, agentType = null, projectId = null) => {
    try {
      const activeProj = projectId || localStorage.getItem('vani_active_project_id') || undefined;
      const formattedHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const payload = {
        prompt: promptText,
        messages: [...formattedHistory, { role: 'user', content: promptText }],
        agentType: agentType || undefined,
        projectId: activeProj,
        language_code: currentLang,
        personality,
        history: formattedHistory,
        profile: getProfile(),
        speaker: getSpeaker()
      };
      const response = await axios.post('/api/ai/chat', payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });
      setIsSimulatorMode(!!response.data.simulated);
      return response.data;
    } catch (error) {
      console.error('API submission failed:', error);
      const errorMsg = error.response?.data?.error || error.message || 'AI generation failed';
      throw new Error(errorMsg);
    }
  };

  // ─── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#04020A]">
        <div className="cyber-bg" />
        <div className="flex flex-col items-center gap-4 z-10">
          <Sparkles size={32} className="text-cyber-cyan animate-spin" />
          <p className="text-white/40 text-sm font-semibold">Loading Vani AI...</p>
        </div>
      </div>
    );
  }

  // ─── Auth guard: show login if no session user ────────────────────────────
  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-cyber-bg overflow-hidden text-cyber-text select-none font-sans relative">
      <div className="cyber-bg" />

      {/* Mic permission modal — outside overflow-hidden so it overlays correctly */}
      {!micPrompted && <MicPermissionModal onAllow={handleMicAllow} onDismiss={handleMicDismiss} />}

      <Sidebar
        activeTab={activeTab}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
        onNewChat={handleLoadSession}
        user={user}
        logout={logout}
        accessibilityMode={accessibilityMode}
      />

      {/* Main content — pb-16 on mobile for bottom nav bar */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 pb-16 md:pb-0">
        {backendOffline && !dismissOffline && <OfflineBanner onDismiss={() => setDismissOffline(true)} />}
        {isSimulatorMode && <SimulatorBanner />}

        <Routes>
          <Route path="/" element={
            <Workspace
              currentLang={currentLang}
              setCurrentLang={setCurrentLang}
              personality={personality}
              voiceSpeed={voiceSpeed}
              voiceRecorder={voiceRecorder}
              messages={messages}
              setMessages={setMessages}
              autoSpeak={getAutoSpeak()}
              accessibilityMode={accessibilityMode}
            />
          } />
          <Route path="/workspace" element={<Navigate to="/" replace />} />
          <Route path="/chat" element={<Navigate to="/" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/project/:id" element={<Project />} />
          <Route path="/assistant" element={
            <Assistant
              currentLang={currentLang}
              setCurrentLang={setCurrentLang}
              voiceSpeed={voiceSpeed}
              voiceRecorder={voiceRecorder}
              onSubmitPrompt={onSubmitPrompt}
              onEndSession={() => navigate('/')}
              accessibilityMode={accessibilityMode}
            />
          } />
          <Route path="/settings" element={
            <Settings
              currentLang={currentLang}
              setCurrentLang={setCurrentLang}
              personality={personality}
              setPersonality={setPersonality}
              voiceSpeed={voiceSpeed}
              setVoiceSpeed={setVoiceSpeed}
              apiKey={apiKey}
              setApiKey={setApiKey}
              accessibilityMode={accessibilityMode}
              setAccessibilityMode={setAccessibilityMode}
            />
          } />
          <Route path="/why-vani" element={
            <WhyVani setActiveTab={(tab) => navigate(`/${tab}`)} accessibilityMode={accessibilityMode} />
          } />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <ChatHistoryProvider>
      <AppInner />
    </ChatHistoryProvider>
  </AuthProvider>
);

export default App;
