import React, { useState, useEffect } from 'react';
import {
  Settings, Menu, X, Globe, Radio,
  LogOut, Plus, Trash2, ChevronDown, ChevronRight, Clock, CheckCircle2,
  Folder, FileText, Sparkles, Layers, CheckSquare, Calendar
} from 'lucide-react';
import { useChatHistory } from '../context/ChatHistoryContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { CANONICAL_AGENTS } from '../config/canonicalAgents';
import { apiClient } from '../lib/api';

const FAVORITE_AGENT_IDS = ['auto', 'research', 'brd', 'build'];

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी', sub: 'Hindi' },
  { code: 'en-IN', label: 'English', sub: 'English' },
  { code: 'as-IN', label: 'অসমীয়া', sub: 'Assamese' },
  { code: 'bn-IN', label: 'বাংলা', sub: 'Bengali' },
  { code: 'brx-IN', label: 'बड़ो', sub: 'Bodo' },
  { code: 'doi-IN', label: 'डोगरी', sub: 'Dogri' },
  { code: 'gu-IN', label: 'ગુજરાતી', sub: 'Gujarati' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', sub: 'Kannada' },
  { code: 'ks-IN', label: 'कॉशुर', sub: 'Kashmiri' },
  { code: 'kok-IN', label: 'कोंकणी', sub: 'Konkani' },
  { code: 'mai-IN', label: 'मैथिली', sub: 'Maithili' },
  { code: 'ml-IN', label: 'മലയാളം', sub: 'Malayalam' },
  { code: 'mni-IN', label: 'ꯃꯤꯇꯩꯂꯣꯟ', sub: 'Manipuri' },
  { code: 'mr-IN', label: 'मराठी', sub: 'Marathi' },
  { code: 'ne-IN', label: 'नेपाली', sub: 'Nepali' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ', sub: 'Odia' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', sub: 'Punjabi' },
  { code: 'sa-IN', label: 'संस्कृत', sub: 'Sanskrit' },
  { code: 'sat-IN', label: 'ᱥᱟᱱᱛᱟᱲᱤ', sub: 'Santali' },
  { code: 'sd-IN', label: 'सिन्धी', sub: 'Sindhi' },
  { code: 'ta-IN', label: 'தமிழ்', sub: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు', sub: 'Telugu' },
  { code: 'ur-IN', label: 'اردو', sub: 'Urdu' },
];

function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Sidebar({
  activeTab,
  currentLang,
  setCurrentLang,
  onNewChat,
  user,
  logout,
  accessibilityMode,
  projects: propProjects = [],
  selectedProjectId: propSelectedProjectId,
  onSelectProject,
  selectedAgent: propSelectedAgent,
  onSelectAgent
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [workOpen, setWorkOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(false); // Collapsed by default as requested
  const [allAgentsModalOpen, setAllAgentsModalOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const [internalProjects, setInternalProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => propSelectedProjectId || localStorage.getItem('vani_active_project_id') || '');
  const [activeAgentId, setActiveAgentId] = useState(() => propSelectedAgent || 'auto');

  const { sessions, currentSessionId, loadSession, deleteSession, startNewSession, isLoggedIn } = useChatHistory();
  const navigate = useNavigate();
  const location = useLocation();

  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Keyboard accessibility: close drawer / modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setAllAgentsModalOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch projects if not passed via props
  useEffect(() => {
    if (propProjects && propProjects.length > 0) {
      setInternalProjects(propProjects);
    } else {
      apiClient.get('/projects')
        .then(res => {
          if (Array.isArray(res.data)) {
            setInternalProjects(res.data);
            if (!activeProjectId && res.data.length > 0) {
              setActiveProjectId(res.data[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [propProjects]);

  useEffect(() => {
    if (propSelectedProjectId) setActiveProjectId(propSelectedProjectId);
  }, [propSelectedProjectId]);

  useEffect(() => {
    if (propSelectedAgent) setActiveAgentId(propSelectedAgent);
  }, [propSelectedAgent]);

  useEffect(() => {
    if (pendingDeleteId) {
      const timer = setTimeout(() => setPendingDeleteId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [pendingDeleteId]);

  useEffect(() => {
    const handleOutsideClick = () => setPendingDeleteId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    if (pendingDeleteId === id) {
      deleteSession(id);
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(id);
    }
  };

  const currentLangObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];
  const handleLangChange = (code) => { setCurrentLang(code); setLangOpen(false); };

  const handleSessionClick = (session) => {
    loadSession(session.id);
    navigate('/');
    setMobileOpen(false);
    if (onNewChat) onNewChat(session.messages, session.lang);
  };

  const handleNewChatClick = () => {
    const id = startNewSession(currentLang);
    navigate('/');
    setMobileOpen(false);
    if (onNewChat) onNewChat([], currentLang, id);
  };

  const handleProjectClick = (proj) => {
    setActiveProjectId(proj.id);
    localStorage.setItem('vani_active_project_id', proj.id);
    if (onSelectProject) onSelectProject(proj.id);
    navigate(`/?projectId=${proj.id}`);
    setMobileOpen(false);
  };

  const handleAgentClick = (agent) => {
    setActiveAgentId(agent.id);
    if (onSelectAgent) onSelectAgent(agent.id);
    navigate(`/?agent=${agent.id}`);
    setMobileOpen(false);
  };

  const displayProjects = propProjects.length > 0 ? propProjects : internalProjects;

  return (
    <>
      {/* ── Mobile Top Bar ────────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 glass-panel border-b border-white/5 sticky top-0 z-40">
        <div className="flex items-center gap-2" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-purple flex-shrink-0">
            <span className="font-extrabold text-sm text-cyber-bg">V</span>
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">VANI AI</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLangOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-bold"
          >
            <Globe size={12} className="text-cyber-cyan" />
            <span>{currentLangObj.label.slice(0, 6)}</span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {langOpen && (
          <div className="absolute top-full left-0 right-0 glass-panel !bg-[#110e20] border-b border-white/10 z-50 grid grid-cols-4 gap-1 p-3">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLangChange(lang.code)}
                className={`px-2 py-2 rounded-lg text-xs font-bold text-center transition-all ${
                  currentLang === lang.code
                    ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30'
                    : 'bg-white/5 text-white/60 border border-white/5 hover:bg-white/10'
                }`}
              >
                {lang.label.slice(0, 5)}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className={`
        hidden md:flex flex-col glass-panel border-r border-white/5
        transition-all duration-300 ease-in-out h-full overflow-hidden flex-shrink-0
        ${collapsed ? 'w-20' : 'w-72'}
      `}>
        {/* Branding */}
        <div className="p-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 min-w-9 rounded-xl bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-neon">
              <Radio size={18} className="text-white animate-pulse" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-white/90 to-cyber-cyan bg-clip-text text-transparent">VANI AI</span>
                <span className="text-[10px] text-cyber-cyan font-semibold tracking-widest uppercase">Agentic Workspace</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation / Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-4">
          
          {/* + New Chat Button */}
          {!collapsed ? (
            <button
              onClick={handleNewChatClick}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyber-cyan text-cyber-bg font-extrabold text-xs shadow-glow-neon hover:bg-cyber-cyan/90 transition-all"
            >
              <Plus size={15} />
              <span>New Conversation</span>
            </button>
          ) : (
            <button
              onClick={handleNewChatClick}
              className="w-full flex items-center justify-center p-2.5 rounded-xl bg-cyber-cyan text-cyber-bg shadow-glow-neon hover:bg-cyber-cyan/90 transition-all"
              title="New Conversation"
            >
              <Plus size={16} />
            </button>
          )}

          {/* ── Section 1: Conversations (Recent Chats) ───────────────────── */}
          {!collapsed && isLoggedIn && (
            <div className="space-y-1">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-white/40 hover:text-white/70 transition-colors text-[11px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-cyber-purple" />
                  <span>Conversations</span>
                  <span className="text-[10px] text-white/20 font-mono">({sessions.length})</span>
                </div>
                {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {historyOpen && (
                <div className="space-y-0.5 pl-1">
                  {sessions.length === 0 ? (
                    <p className="text-[10px] text-white/30 py-1 px-2 italic">No conversations yet</p>
                  ) : (
                    sessions.slice(0, 8).map(session => (
                      <div
                        key={session.id}
                        onClick={() => handleSessionClick(session)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${
                          currentSessionId === session.id
                            ? 'bg-cyber-purple/20 text-white border border-cyber-purple/30 font-semibold'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate flex-1 pr-1">{session.title || 'Chat Session'}</span>
                        <button
                          onClick={(e) => handleDeleteClick(e, session.id)}
                          className={`p-1 transition-all ${
                            pendingDeleteId === session.id ? 'text-red-400 bg-red-500/10 rounded' : 'opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400'
                          }`}
                        >
                          {pendingDeleteId === session.id ? <CheckCircle2 size={11} className="text-red-400" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 2: Projects ─────────────────────────────────────────── */}
          {!collapsed && (
            <div className="space-y-1">
              <button
                onClick={() => setProjectsOpen(!projectsOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-white/40 hover:text-white/70 transition-colors text-[11px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <Folder size={12} className="text-cyber-cyan" />
                  <span>Projects</span>
                  <span className="text-[10px] text-white/20 font-mono">({displayProjects.length})</span>
                </div>
                {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {projectsOpen && (
                <div className="space-y-0.5 pl-1">
                  {displayProjects.length === 0 ? (
                    <p className="text-[10px] text-white/30 py-1 px-2 italic">No projects created yet</p>
                  ) : (
                    displayProjects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={() => handleProjectClick(proj)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between group ${
                          activeProjectId === proj.id
                            ? 'bg-cyber-cyan/15 text-cyber-cyan font-bold border border-cyber-cyan/30'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{proj.name}</span>
                        {activeProjectId === proj.id && <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan" />}
                      </button>
                    ))
                  )}

                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-cyber-cyan hover:bg-cyber-cyan/10 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={12} /> All Projects & Documents
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Section: Work (Documents, Tasks, Research, Scheduled Actions) ── */}
          {!collapsed ? (
            <div className="space-y-1">
              <button
                onClick={() => setWorkOpen(!workOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-white/40 hover:text-white/70 transition-colors text-[11px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-indigo-400" />
                  <span>Work</span>
                </div>
                {workOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {workOpen && (
                <div className="space-y-0.5 pl-1">
                  <button
                    onClick={() => navigate('/dashboard?tab=documents')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      location.pathname === '/dashboard' && location.search.includes('tab=documents')
                        ? 'bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText size={12} className="text-cyan-400" />
                    <span>Documents</span>
                  </button>

                  <button
                    onClick={() => navigate('/dashboard?tab=tasks')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      location.pathname === '/dashboard' && location.search.includes('tab=tasks')
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <CheckSquare size={12} className="text-emerald-400" />
                    <span>Tasks</span>
                  </button>

                  <button
                    onClick={() => navigate('/dashboard?tab=research')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      location.pathname === '/dashboard' && location.search.includes('tab=research')
                        ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Globe size={12} className="text-indigo-400" />
                    <span>Research</span>
                  </button>

                  <button
                    onClick={() => navigate('/dashboard?tab=scheduled')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      location.pathname === '/dashboard' && location.search.includes('tab=scheduled')
                        ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Calendar size={12} className="text-amber-400" />
                    <span>Scheduled Actions</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full p-2 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/5"
                title="Work: Documents, Tasks & Research"
              >
                <Layers size={16} />
              </button>
            </div>
          )}

          {/* ── Section: Agents (Auto + Favorites + Picker Trigger) ────────── */}
          {!collapsed ? (
            <div className="space-y-1">
              <button
                onClick={() => setAgentsOpen(!agentsOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-white/40 hover:text-white/70 transition-colors text-[11px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-emerald-400" />
                  <span>Agents</span>
                </div>
                {agentsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {agentsOpen && (
                <div className="space-y-0.5 pl-1">
                  {CANONICAL_AGENTS.filter(a => FAVORITE_AGENT_IDS.includes(a.id)).map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => handleAgentClick(agent)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                        activeAgentId === agent.id
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs leading-none">{agent.icon}</span>
                        <span className="truncate">{agent.name}</span>
                      </div>
                      {activeAgentId === agent.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  ))}

                  <button
                    onClick={() => setAllAgentsModalOpen(true)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5 mt-1"
                  >
                    <Plus size={11} /> All Agents ({CANONICAL_AGENTS.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAllAgentsModalOpen(true)}
              className="w-full p-2 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/5"
              title="All Agents"
            >
              <Sparkles size={16} />
            </button>
          )}

          {/* ── Settings ───────────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-2">
            <button
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/settings' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings size={14} className="text-cyan-400 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </button>
          </div>
        </div>

        {/* ── Bottom Section: Language & User ───────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-white/5 p-3 space-y-2">
          {!collapsed && (
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 transition-all text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe size={13} className="text-cyber-cyan" />
                  <span className="font-semibold text-white/80 truncate">{currentLangObj.label}</span>
                </div>
                <ChevronDown size={11} className="text-white/40" />
              </button>

              {langOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 glass-panel !bg-[#0e0a1f] border border-white/10 rounded-xl overflow-y-auto max-h-56 shadow-2xl z-50 p-1 custom-scrollbar">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleLangChange(lang.code)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-lg text-xs ${
                        currentLang === lang.code ? 'bg-cyber-cyan/15 text-cyber-cyan font-bold' : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] text-white/30">{lang.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Status */}
          {!collapsed && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-cyber-purple/20 border border-cyber-purple/30 flex items-center justify-center text-xs font-bold text-cyber-neonPurple">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate">{user?.name || 'Local User'}</p>
                  <p className="text-[10px] text-white/30 truncate">{user?.email || 'Logged in'}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1 text-white/30 hover:text-rose-400 rounded transition-colors"
                title="Log out"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white transition-colors"
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer Backdrop ────────────────────────────────────────── */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="md:hidden fixed inset-0 bg-black/75 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer ─────────────────────────────────────────────────── */}
      <aside className={`
        md:hidden fixed top-0 left-0 bottom-0 w-4/5 max-w-[300px] z-50
        flex flex-col glass-panel !bg-[#0b0818] border-r border-white/10
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <span className="font-bold text-white text-sm">VANI AI Workspace</span>
          <button onClick={() => setMobileOpen(false)} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <button
            onClick={handleNewChatClick}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyber-cyan text-cyber-bg font-bold text-xs shadow-md"
          >
            <Plus size={14} /> New Conversation
          </button>

          {/* Mobile Work Section */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Work</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { navigate('/dashboard?tab=documents'); setMobileOpen(false); }}
                className="p-2 rounded-lg bg-white/5 text-white/80 hover:text-white text-xs flex items-center gap-1.5 text-left"
              >
                <FileText size={12} className="text-cyan-400" />
                <span>Documents</span>
              </button>
              <button
                onClick={() => { navigate('/dashboard?tab=tasks'); setMobileOpen(false); }}
                className="p-2 rounded-lg bg-white/5 text-white/80 hover:text-white text-xs flex items-center gap-1.5 text-left"
              >
                <CheckSquare size={12} className="text-emerald-400" />
                <span>Tasks</span>
              </button>
              <button
                onClick={() => { navigate('/dashboard?tab=research'); setMobileOpen(false); }}
                className="p-2 rounded-lg bg-white/5 text-white/80 hover:text-white text-xs flex items-center gap-1.5 text-left"
              >
                <Globe size={12} className="text-indigo-400" />
                <span>Research</span>
              </button>
              <button
                onClick={() => { navigate('/dashboard?tab=scheduled'); setMobileOpen(false); }}
                className="p-2 rounded-lg bg-white/5 text-white/80 hover:text-white text-xs flex items-center gap-1.5 text-left"
              >
                <Calendar size={12} className="text-amber-400" />
                <span>Schedule</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Projects</span>
            {displayProjects.map(proj => (
              <button
                key={proj.id}
                onClick={() => handleProjectClick(proj)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
                  activeProjectId === proj.id ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                {proj.name}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Agents</span>
            {CANONICAL_AGENTS.filter(a => FAVORITE_AGENT_IDS.includes(a.id)).map(agent => (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/5 flex items-center gap-2"
              >
                <span>{agent.icon}</span>
                <span>{agent.name}</span>
              </button>
            ))}
            <button
              onClick={() => { setMobileOpen(false); setAllAgentsModalOpen(true); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 font-bold hover:bg-emerald-500/10 flex items-center gap-1.5"
            >
              <Plus size={12} /> All Agents ({CANONICAL_AGENTS.length})
            </button>
          </div>

          {/* Mobile Settings & Profile */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <button
              onClick={() => { navigate('/settings'); setMobileOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/settings' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings size={14} className="text-cyan-400 shrink-0" />
              <span>Settings</span>
            </button>

            {isLoggedIn && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cyber-purple/20 border border-cyber-purple/30 flex items-center justify-center text-xs font-bold text-cyber-neonPurple">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{user?.name || 'Local User'}</p>
                    <p className="text-[10px] text-white/30 truncate">{user?.email || 'Logged in'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="p-1 text-white/40 hover:text-rose-400 rounded transition-colors"
                  title="Log out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── All Agents Modal Picker ────────────────────────────────────────── */}
      {allAgentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Agent Directory</h3>
                  <p className="text-xs text-slate-400">Choose a specialized AI agent for your current objective</p>
                </div>
              </div>
              <button 
                onClick={() => setAllAgentsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 custom-scrollbar pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CANONICAL_AGENTS.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      handleAgentClick(agent);
                      setAllAgentsModalOpen(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                      activeAgentId === agent.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/[0.03] border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.06] text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{agent.icon}</span>
                        <span className="font-bold text-xs text-white group-hover:text-emerald-300 transition-colors">{agent.name}</span>
                      </div>
                      {activeAgentId === agent.id && (
                        <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {agent.description}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Provider: {agent.preferredProvider || 'auto'}</span>
                      <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-sans font-semibold">Select →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
