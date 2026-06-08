import React, { useState } from 'react';
import {
  Home, MessageSquare, Mic, Settings, Menu, X, Globe, Radio,
  LogOut, User, Plus, Trash2, ChevronDown, ChevronRight, Clock
} from 'lucide-react';
import { useChatHistory } from '../context/ChatHistoryContext';

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी', sub: 'Hindi' },
  { code: 'en-IN', label: 'English', sub: 'English (IN)' },
  { code: 'mr-IN', label: 'मराठी', sub: 'Marathi' },
  { code: 'ta-IN', label: 'தமிழ்', sub: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు', sub: 'Telugu' },
  { code: 'bn-IN', label: 'বাংলা', sub: 'Bengali' },
  { code: 'gu-IN', label: 'ગુજરાતી', sub: 'Gujarati' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', sub: 'Kannada' },
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

const Sidebar = ({ activeTab, setActiveTab, currentLang, setCurrentLang, onNewChat, user, logout }) => {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [langOpen, setLangOpen]     = useState(false);

  const isGuest = user?.isGuest || false;
  const { sessions, currentSessionId, loadSession, deleteSession, startNewSession, isLoggedIn } = useChatHistory();

  const menuItems = [
    { id: 'home',      label: 'Home',           icon: Home },
    { id: 'chat',      label: 'Chat Assistant',  icon: MessageSquare },
    { id: 'assistant', label: 'Voice Mode',      icon: Mic },
    { id: 'settings',  label: 'System Settings', icon: Settings },
  ];

  const currentLangObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  const handleLangChange = (code) => { setCurrentLang(code); setLangOpen(false); };

  const handleSessionClick = (session) => {
    loadSession(session.id);
    setActiveTab('chat');
    setMobileOpen(false);
    if (onNewChat) onNewChat(session.messages, session.lang);
  };

  const handleNewChat = () => {
    const id = startNewSession(currentLang);
    setActiveTab('chat');
    setMobileOpen(false);
    if (onNewChat) onNewChat([], currentLang, id);
  };

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Mobile Top Bar ────────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 glass-panel border-b border-white/5 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-purple flex-shrink-0">
            <span className="font-extrabold text-sm text-cyber-bg">V</span>
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Vani AI</span>
        </div>

        {/* Mobile language quick-switcher */}
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
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile language dropdown */}
        {langOpen && (
          <div className="absolute top-full left-0 right-0 glass-panel border-b border-white/10 z-50 grid grid-cols-4 gap-1 p-3">
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

      {/* ── Mobile Bottom Navigation Bar ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-white/8 flex items-center justify-around px-2 py-2 safe-area-bottom">
        {menuItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] ${
                isActive
                  ? 'text-cyber-cyan bg-cyber-cyan/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-cyber-cyan' : ''} />
              <span className="text-[9px] font-bold tracking-wide truncate max-w-[52px]">
                {id === 'assistant' ? 'Voice' : id === 'settings' ? 'Settings' : label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className={`
        hidden md:flex flex-col glass-panel border-r border-white/5
        transition-all duration-300 ease-in-out h-full overflow-hidden flex-shrink-0
        ${collapsed ? 'w-20' : 'w-72'}
      `}>
        {/* Branding */}
        <div className="p-5 flex items-center justify-between border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 min-w-10 rounded-xl bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-neon">
              <Radio size={20} className="text-white animate-pulse" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-white via-white/90 to-cyber-cyan bg-clip-text text-transparent">VANI AI</span>
                <span className="text-[10px] text-cyber-cyan font-semibold tracking-widest uppercase">Saaras-Bulbul v3</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* Chat History */}
          {isLoggedIn && !collapsed && (
            <div className="border-b border-white/5">
              <button
                onClick={() => setHistoryOpen(h => !h)}
                className="w-full flex items-center justify-between px-5 py-3 text-white/40 hover:text-white/70 transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <div className="flex items-center gap-2">
                  <Clock size={12} />
                  <span>Recent Chats</span>
                </div>
                {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {historyOpen && (
                <div className="px-3 pb-3 space-y-1">
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-cyber-cyan/80 hover:text-cyber-cyan hover:bg-cyber-cyan/5 border border-dashed border-cyber-cyan/20 hover:border-cyber-cyan/40 transition-all text-xs font-semibold"
                  >
                    <Plus size={13} />
                    New Chat
                  </button>

                  {sessions.length === 0 ? (
                    <p className="text-[10px] text-white/20 text-center py-3 font-medium">No conversations yet</p>
                  ) : (
                    sessions.slice(0, 10).map(session => (
                      <div
                        key={session.id}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                          currentSessionId === session.id
                            ? 'bg-cyber-cyan/10 border border-cyber-cyan/20'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                        onClick={() => handleSessionClick(session)}
                      >
                        <MessageSquare size={12} className={currentSessionId === session.id ? 'text-cyber-cyan' : 'text-white/30'} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${currentSessionId === session.id ? 'text-cyber-cyan' : 'text-white/70'}`}>
                            {session.title}
                          </p>
                          <p className="text-[9px] text-white/25 font-medium">{relativeTime(session.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition-all flex-shrink-0"
                          title="Delete session"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="py-4 px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 group
                    ${isActive
                      ? 'bg-gradient-to-r from-cyber-purple/20 to-cyber-cyan/10 border border-cyber-cyan/15 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}
                  `}
                >
                  <Icon size={18} className={`
                    transition-transform duration-200 group-hover:scale-110 flex-shrink-0
                    ${isActive ? 'text-cyber-cyan' : 'text-white/50 group-hover:text-white'}
                  `} />
                  {!collapsed && <span className="font-semibold text-sm">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="flex-shrink-0 border-t border-white/5 p-4 space-y-3">

          {/* Language Selector */}
          {!collapsed && (
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-cyber-cyan/20 transition-all"
              >
                <Globe size={15} className="text-cyber-cyan flex-shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[10px] text-white/35 font-semibold uppercase tracking-wider leading-none mb-0.5">Language</p>
                  <p className="text-xs text-white/90 font-bold truncate">
                    {currentLangObj.label} · {currentLangObj.sub}
                  </p>
                </div>
                <ChevronDown size={13} className={`text-white/30 transition-transform flex-shrink-0 ${langOpen ? 'rotate-180' : ''}`} />
              </button>

              {langOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 glass-panel border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleLangChange(lang.code)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/8 transition-colors ${
                        currentLang === lang.code ? 'bg-cyber-cyan/10 text-cyber-cyan' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <span className="text-sm font-bold w-10 flex-shrink-0">{lang.label}</span>
                      <span className="text-xs text-white/40">{lang.sub}</span>
                      {currentLang === lang.code && <span className="ml-auto text-cyber-cyan text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Info */}
          {!collapsed && (
            <div className="glass-panel bg-white/3 rounded-xl p-3 border border-white/5">
              {isLoggedIn ? (
                <div className="flex items-center gap-2.5">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 min-w-8 rounded-lg border border-cyber-cyan/20 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 min-w-8 rounded-lg bg-gradient-to-tr from-cyber-purple/40 to-cyber-cyan/20 border border-cyber-cyan/20 flex items-center justify-center text-cyber-cyan font-black text-xs">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-bold truncate">{user.name}</p>
                    <p className="text-[10px] text-white/30 truncate">{user.email}</p>
                  </div>
                  <button onClick={logout} title="Sign out" className="p-1.5 text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex-shrink-0">
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 min-w-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/30">
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/60 font-semibold">Guest Mode</p>
                    <p className="text-[10px] text-white/25">History not saved</p>
                  </div>
                  <button onClick={logout} title="Go to login" className="text-[10px] text-cyber-cyan hover:text-white border border-cyber-cyan/20 hover:border-cyber-cyan/60 px-2 py-1 rounded-lg font-bold transition-all flex-shrink-0">
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 border border-white/5 rounded-xl text-white/30 hover:text-white hover:border-white/15 transition-all text-xs font-bold uppercase tracking-wider"
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar (full panel for chat history) */}
      <aside className={`
        md:hidden fixed top-0 left-0 bottom-0 w-4/5 max-w-[320px] z-50
        flex flex-col glass-panel border-r border-white/8
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-neon">
              <Radio size={16} className="text-white animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-white">VANI AI</p>
              <p className="text-[9px] text-cyber-cyan font-bold tracking-widest uppercase">Saaras-Bulbul v3</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-2 text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Mobile Chat History */}
          {isLoggedIn && (
            <div className="border-b border-white/5 px-3 py-3 space-y-1">
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider px-2 mb-2">Recent Chats</p>
              <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-cyber-cyan/80 hover:bg-cyber-cyan/5 border border-dashed border-cyber-cyan/20 transition-all text-xs font-semibold">
                <Plus size={12} /> New Chat
              </button>
              {sessions.slice(0, 8).map(session => (
                <div key={session.id} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 border border-transparent transition-all" onClick={() => handleSessionClick(session)}>
                  <MessageSquare size={11} className="text-white/30 flex-shrink-0" />
                  <p className="text-xs text-white/60 truncate flex-1">{session.title}</p>
                </div>
              ))}
            </div>
          )}

          {/* Mobile Nav */}
          <nav className="py-3 px-3 space-y-1">
            {menuItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-cyber-purple/20 to-cyber-cyan/10 border border-cyber-cyan/15 text-white'
                    : 'text-white/50 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={16} className={activeTab === id ? 'text-cyber-cyan' : 'text-white/40'} />
                <span className="font-semibold text-sm">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile user strip */}
        <div className="p-3 border-t border-white/5 flex-shrink-0">
          {isLoggedIn ? (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-white/5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyber-purple/40 to-cyber-cyan/20 flex items-center justify-center text-cyber-cyan font-black text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <p className="text-xs text-white/70 font-semibold flex-1 truncate">{user?.name}</p>
              <button onClick={logout} className="p-1.5 text-white/30 hover:text-red-400 transition-colors"><LogOut size={13} /></button>
            </div>
          ) : (
            <button onClick={() => { logout(); setMobileOpen(false); }} className="w-full py-2.5 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl text-cyber-cyan text-xs font-bold">
              Sign In to Save History
            </button>
          )}
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
      )}
    </>
  );
};

export default Sidebar;
