import React, { useState } from 'react';
import { Home, MessageSquare, Mic, Settings, Menu, X, Globe, Radio } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, currentLang }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chat', label: 'Chat Assistant', icon: MessageSquare },
    { id: 'assistant', label: 'Voice Mode', icon: Mic },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  const languages = {
    'hi-IN': 'हिंदी (Hindi)',
    'en-IN': 'English (IN)',
    'mr-IN': 'मराठी (Marathi)',
    'ta-IN': 'தமிழ் (Tamil)',
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-purple">
            <span className="font-extrabold text-sm text-cyber-bg">V</span>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Vani AI</span>
        </div>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/5 transition-all"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar - Desktop and Mobile Panel */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 md:sticky
        flex flex-col glass-panel border-r border-white/5
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        h-full
      `}>
        {/* Close button for Mobile */}
        <div className="md:hidden absolute top-4 right-4">
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-2 text-white/70 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Branding header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
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

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-cyber-purple/20 to-cyber-cyan/10 border-l-4 border-cyber-cyan text-white shadow-glow-cyan/5' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'}
                `}
              >
                <Icon size={20} className={`
                  transition-transform duration-200 group-hover:scale-110
                  ${isActive ? 'text-cyber-cyan' : 'text-white/60 group-hover:text-white'}
                `} />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer info & collapse switch */}
        <div className="p-6 border-t border-white/5 space-y-4">
          {!collapsed && (
            <div className="glass-panel p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 flex items-center justify-center text-cyber-cyan">
                <Globe size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40 font-medium">Selected Language</span>
                <span className="text-xs text-white/90 font-bold">{languages[currentLang] || 'English'}</span>
              </div>
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full items-center justify-center py-2 border border-white/5 rounded-xl text-white/40 hover:text-white hover:border-white/15 transition-all text-xs font-semibold uppercase tracking-wider"
          >
            {collapsed ? '→' : '← Minimize'}
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}
    </>
  );
};

export default Sidebar;
