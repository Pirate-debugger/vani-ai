import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  FileText, 
  CheckSquare, 
  Folder, 
  Plus, 
  Globe, 
  Mic, 
  Settings, 
  Code2, 
  ArrowRight,
  X,
  Layers
} from 'lucide-react';
import axios from 'axios';

export default function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onNewProject,
  onSelectProject,
  onOpenDocument,
  onSwitchMode,
  onToggleVoice,
  onOpenSettings,
  onOpenCustomAgentModal,
  onOpenTasks,
  onOpenDocuments
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ projects: [], documents: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Default Quick Commands (Section 52)
  const quickCommands = [
    {
      id: 'cmd-new-chat',
      title: 'New Chat',
      desc: 'Start a fresh conversation with Vani AI',
      icon: Plus,
      category: 'Command',
      action: () => { onNewChat?.(); onClose(); }
    },
    {
      id: 'cmd-new-project',
      title: 'New Project',
      desc: 'Create an isolated workspace with memory and documents',
      icon: Folder,
      category: 'Command',
      action: () => { onNewProject?.(); onClose(); }
    },
    {
      id: 'cmd-create-agent',
      title: 'Create Agent',
      desc: 'Design and deploy a custom autonomous AI specialist',
      icon: Sparkles,
      category: 'Agent',
      action: () => { onOpenCustomAgentModal?.(); onClose(); }
    },
    {
      id: 'cmd-mode-brd',
      title: 'Create BRD',
      desc: 'Generate 29-section Enterprise Business Requirements Document',
      icon: FileText,
      category: 'Agent',
      action: () => { onSwitchMode?.('brd'); onClose(); }
    },
    {
      id: 'cmd-mode-research',
      title: 'Research Web',
      desc: 'Multi-query live competitor search and evidence ranking',
      icon: Globe,
      category: 'Agent',
      action: () => { onSwitchMode?.('research'); onClose(); }
    },
    {
      id: 'cmd-mode-prd',
      title: 'Create PRD',
      desc: 'Structured Product Requirements Document with MoSCoW framework',
      icon: Layers,
      category: 'Agent',
      action: () => { onSwitchMode?.('prd'); onClose(); }
    },
    {
      id: 'cmd-mode-build',
      title: 'Build MVP Plan',
      desc: 'Goal to executable specs, schemas, APIs, and dev tasks',
      icon: Code2,
      category: 'Agent',
      action: () => { onSwitchMode?.('build'); onClose(); }
    },
    {
      id: 'cmd-open-tasks',
      title: 'Open Tasks',
      desc: 'View execution backlog and generated development tasks',
      icon: CheckSquare,
      category: 'Workspace',
      action: () => { onOpenTasks?.(); onClose(); }
    },
    {
      id: 'cmd-open-docs',
      title: 'Open Documents',
      desc: 'Browse project artifacts, BRDs, PRDs, and architecture notes',
      icon: FileText,
      category: 'Workspace',
      action: () => { onOpenDocuments?.(); onClose(); }
    },
    {
      id: 'cmd-toggle-voice',
      title: 'Toggle Voice',
      desc: 'Speak directly to Vani with Sarvam Saaras v4 STT',
      icon: Mic,
      category: 'Input',
      action: () => { onToggleVoice?.(); onClose(); }
    },
    {
      id: 'cmd-settings',
      title: 'Settings & API Keys',
      desc: 'Manage Sarvam, Gemini, OpenAI & TinyFish keys',
      icon: Settings,
      category: 'System',
      action: () => { onOpenSettings?.(); onClose(); }
    }
  ];

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults({ projects: [], documents: [], tasks: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/projects/search?q=${encodeURIComponent(query.trim())}`, {
          withCredentials: true
        });
        setResults({
          projects: res.data?.projects || [],
          documents: res.data?.documents || [],
          tasks: res.data?.tasks || []
        });
      } catch (err) {
        console.warn('Search query error:', err.message);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter commands by query
  const filteredCommands = query.trim()
    ? quickCommands.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase()) || 
        c.desc.toLowerCase().includes(query.toLowerCase())
      )
    : quickCommands;

  const hasSearchHits = results.projects.length > 0 || results.documents.length > 0 || results.tasks.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-md transition-all">
      <div 
        className="w-full max-w-2xl bg-[#0B0914] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <Search size={18} className="text-cyber-cyan mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Vani (projects, docs, tasks, agents, commands)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 text-white/40 hover:text-white rounded mr-2"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60 font-mono">ESC</kbd>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {/* Live Search Results (if query provided and hits found) */}
          {hasSearchHits && (
            <div className="space-y-3">
              {results.projects.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-cyber-cyan uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <Folder size={12} /> Projects ({results.projects.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onSelectProject?.(p.id); onClose(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-between group transition-all"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white group-hover:text-cyber-cyan transition-colors">{p.name}</div>
                          {p.description && <div className="text-xs text-white/40 truncate max-w-md">{p.description}</div>}
                        </div>
                        <ArrowRight size={13} className="text-white/20 group-hover:text-cyber-cyan transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.documents.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-cyber-purple uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <FileText size={12} /> Documents ({results.documents.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.documents.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { onOpenDocument?.(d.id); onClose(); }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-between group transition-all"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white group-hover:text-cyber-purple transition-colors flex items-center gap-2">
                            <span>{d.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">{d.type}</span>
                          </div>
                          <div className="text-xs text-white/40">Project: {d.project?.name || 'Workspace'}</div>
                        </div>
                        <ArrowRight size={13} className="text-white/20 group-hover:text-cyber-purple transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.tasks.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                    <CheckSquare size={12} /> Tasks ({results.tasks.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.tasks.map(t => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="text-white font-medium">{t.title}</span>
                          {t.project?.name && <span className="text-white/40 ml-2">in {t.project.name}</span>}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                          t.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions & Agents */}
          <div>
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-2 py-1">
              {query.trim() && !hasSearchHits ? 'Suggested Commands' : 'Quick Actions & Agents'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
              {filteredCommands.map((cmd) => {
                const IconComp = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border border-white/5 hover:border-cyber-cyan/30 text-left transition-all flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 group-hover:bg-cyber-cyan/20 text-cyber-purple group-hover:text-cyber-cyan flex items-center justify-center shrink-0 transition-colors">
                      <IconComp size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white group-hover:text-cyber-cyan flex items-center justify-between transition-colors">
                        <span>{cmd.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/40 uppercase">{cmd.category}</span>
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">{cmd.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 text-[11px] text-white/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">ENTER</kbd>
          </div>
          <div className="text-cyber-cyan/80 flex items-center gap-1">
            <Sparkles size={11} /> Vani AI 2.0 Command Center
          </div>
        </div>
      </div>
    </div>
  );
}
