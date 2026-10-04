import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  User, 
  Trash2, 
  Plus, 
  Copy, 
  Check, 
  Globe, 
  Cpu, 
  Layers, 
  Square,
  ChevronDown,
  Paperclip,
  Folder,
  FileText,
  X,
  Maximize2,
  Minimize2,
  Split,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { CANONICAL_AGENTS } from '../config/canonicalAgents';
import AgentActivityCard from '../components/AgentActivityCard';
import VoiceOrb from '../components/VoiceOrb';
import DocumentViewer from '../components/DocumentViewer';

export default function Workspace({
  currentLang,
  setCurrentLang,
  personality,
  voiceSpeed,
  voiceRecorder,
  messages,
  setMessages,
  autoSpeak = true,
  accessibilityMode = false
}) {
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showVoiceOrb, setShowVoiceOrb] = useState(false);
  const [talkMode, setTalkMode] = useState('tap'); // 'tap' | 'hold'

  // Project & Document context
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem('vani_active_project_id') || '');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'split' | 'document'
  const [docLoading, setDocLoading] = useState(false);

  // New Project modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Active streaming state
  const [activeExecution, setActiveExecution] = useState(null);
  const abortControllerRef = useRef(null);
  const chatEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const projectDropdownRef = useRef(null);

  const {
    isRecording,
    isSttLoading,
    isSpeaking,
    transcript,
    liveTranscript,
    audioBlob,
    audioAnalyser,
    startRecording,
    stopRecording,
    speakWithTTS,
    cancelSpeech,
    resetAudioBlob,
    voiceState
  } = voiceRecorder;

  // ─── Fetch User Projects ──────────────────────────────────────────────────
  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects', { withCredentials: true });
      if (Array.isArray(res.data)) {
        setProjects(res.data);
        // Default to first active project if none selected
        if (!selectedProjectId && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
          localStorage.setItem('vani_active_project_id', res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err.message);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = (projId) => {
    setSelectedProjectId(projId);
    localStorage.setItem('vani_active_project_id', projId);
    setProjectDropdownOpen(false);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const res = await axios.post('/api/projects', {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined
      }, { withCredentials: true });

      if (res.data?.id) {
        setProjects(prev => [res.data, ...prev]);
        setSelectedProjectId(res.data.id);
        localStorage.setItem('vani_active_project_id', res.data.id);
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAgentDropdownOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, activeExecution]);

  // STT Auto-submit hook
  useEffect(() => {
    if (!audioBlob) return;
    const waitAndSubmit = async () => {
      try {
        const text = await voiceRecorder.waitForTranscript();
        if (text) await submitStreamMessage(text);
      } catch (err) {
        console.error('[Voice Submit Error]:', err);
      } finally {
        resetAudioBlob?.();
      }
    };
    waitAndSubmit();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a document into the workspace
  const loadDocument = async (docId) => {
    if (!docId) return;
    setDocLoading(true);
    try {
      const res = await axios.get(`/api/document/${docId}`, { withCredentials: true });
      if (res.data) {
        setActiveDocument(res.data);
        setViewMode('split');
      }
    } catch (err) {
      console.error('Failed to load document:', err);
    } finally {
      setDocLoading(false);
    }
  };

  // Listen for global document creation events
  useEffect(() => {
    const handleDocCreated = (e) => {
      if (e?.detail?.documentId) {
        loadDocument(e.detail.documentId);
      }
    };
    window.addEventListener('vani_document_created', handleDocCreated);
    return () => window.removeEventListener('vani_document_created', handleDocCreated);
  }, []);

  // ─── Real SSE Streaming Execution ──────────────────────────────────────────
  const submitStreamMessage = async (queryText) => {
    const prompt = queryText.trim();
    if (!prompt || isStreaming) return;

    setInputText('');
    cancelSpeech?.();
    setIsStreaming(true);
    setActiveExecution(null);

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const initialAssistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      agentExecution: null,
      documentId: null,
      documentTitle: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true
    };

    setMessages(prev => [...prev, userMsg, initialAssistantMsg]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
      
      const payload = {
        prompt,
        messages: [...historyPayload, { role: 'user', content: prompt }],
        agentType: selectedAgent !== 'auto' ? selectedAgent : undefined,
        projectId: selectedProjectId || undefined,
        language_code: currentLang || 'hi-IN',
        personality: personality || 'respectful'
      };

      const response = await fetch('/api/ai/orchestrate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let currentExecution = null;
      let finalResultPayload = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // save incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') break;

          try {
            const event = JSON.parse(dataStr);

            // Real backend event handling
            if (event.type === 'agent.started') {
              currentExecution = {
                agentId: event.agent,
                agentName: event.agentName,
                plan: event.plan,
                status: 'running',
                providers: event.preferredProvider ? [event.preferredProvider] : ['gemini'],
                toolsUsed: event.tools || [],
                steps: []
              };
              setActiveExecution(currentExecution);
            } else if (event.type === 'agent.step') {
              if (!currentExecution) {
                currentExecution = {
                  agentId: selectedAgent,
                  status: 'running',
                  steps: []
                };
              }
              const existingIdx = currentExecution.steps.findIndex(s => (s.step === event.step || s.title === event.title));
              const updatedStep = {
                step: event.step,
                title: event.title || event.step,
                status: event.status || 'completed',
                detail: event.detail,
                durationMs: event.durationMs
              };

              if (existingIdx !== -1) {
                currentExecution.steps[existingIdx] = updatedStep;
              } else {
                currentExecution.steps.push(updatedStep);
              }
              setActiveExecution({ ...currentExecution });
            } else if (event.type === 'tool.started') {
              if (currentExecution) {
                if (!currentExecution.toolsUsed) currentExecution.toolsUsed = [];
                if (!currentExecution.toolsUsed.includes(event.tool)) {
                  currentExecution.toolsUsed.push(event.tool);
                }
                setActiveExecution({ ...currentExecution });
              }
            } else if (event.type === 'tool.completed') {
              if (currentExecution) {
                if (event.resultCount) {
                  currentExecution.sourcesCount = event.resultCount;
                }
                setActiveExecution({ ...currentExecution });
              }
            } else if (event.type === 'stream.chunk') {
              accumulatedText += event.delta || '';
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                ...m,
                content: accumulatedText,
                agentExecution: currentExecution
              } : m));
            } else if (event.type === 'agent.completed') {
              if (currentExecution) {
                currentExecution.status = 'completed';
                currentExecution.documentId = event.documentId;
                currentExecution.documentTitle = event.documentTitle;
                currentExecution.tasksCount = event.tasksCount;
                currentExecution.stats = event.stats;
                setActiveExecution({ ...currentExecution });
              }
              if (event.documentId) {
                loadDocument(event.documentId);
              }
            } else if (event.type === 'final.result') {
              finalResultPayload = event.result;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Execution encountered an error');
            }
          } catch (jsonErr) {
            console.warn('[SSE Parse Warn]:', jsonErr.message);
          }
        }
      }

      // Finalize assistant message
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          const finalContent = accumulatedText || finalResultPayload?.response || finalResultPayload?.text || 'Generated result ready.';
          return {
            ...m,
            content: finalContent,
            agentExecution: currentExecution,
            documentId: finalResultPayload?.documentId || currentExecution?.documentId || null,
            documentTitle: finalResultPayload?.documentTitle || currentExecution?.documentTitle || null,
            tasks: finalResultPayload?.tasks || [],
            isStreaming: false
          };
        }
        return m;
      }));

      // Auto-speak response via Sarvam TTS if configured
      const speechText = finalResultPayload?.response || accumulatedText;
      if (autoSpeak && speechText) {
        speakWithTTS(speechText, currentLang, voiceSpeed);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('[Execution Error]:', err);
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          content: `⚠️ Error: ${err.message || 'Execution failed. Please try again.'}`,
          isStreaming: false,
          isError: true
        } : m));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelSpeech?.();
    setIsStreaming(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    submitStreamMessage(inputText.trim());
  };

  const handleCopy = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const currentAgentObj = CANONICAL_AGENTS.find(a => a.id === selectedAgent) || CANONICAL_AGENTS[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05030d] text-white relative overflow-hidden select-none">
      
      {/* ── Top Workspace Header ────────────────────────────────────────────── */}
      <header className="px-4 py-2.5 glass-panel border-b border-white/5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          {/* Project Context Selector */}
          <div className="relative" ref={projectDropdownRef}>
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs font-semibold text-white/90"
              title="Select active project scope"
            >
              <Folder size={14} className="text-cyber-cyan" />
              <span className="max-w-[140px] truncate">{activeProject?.name || 'No Project Selected'}</span>
              <ChevronDown size={12} className="text-white/40" />
            </button>

            {projectDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-xl bg-[#0e0a1f] border border-white/10 shadow-2xl p-1.5 z-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-2 py-1">
                  Active Projects ({projects.length})
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                        selectedProjectId === p.id 
                          ? 'bg-cyber-cyan/15 text-cyber-cyan font-bold border border-cyber-cyan/30' 
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {selectedProjectId === p.id && <Check size={12} />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-1 pt-1">
                  <button
                    onClick={() => { setProjectDropdownOpen(false); setShowNewProjectModal(true); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-cyber-cyan hover:bg-cyber-cyan/10 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={13} /> New Project
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-white/40 font-mono">Online · Unified Workspace</span>
          </div>
        </div>

        {/* View Mode Switcher (when document is active) */}
        <div className="flex items-center gap-2">
          {activeDocument && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => setViewMode('chat')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'chat' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-white/60 hover:text-white'
                }`}
                title="Conversation Only"
              >
                Chat
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'split' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-white/60 hover:text-white'
                }`}
                title="Side-by-side View"
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('document')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'document' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-white/60 hover:text-white'
                }`}
                title="Document Workspace"
              >
                Document
              </button>
              <button
                onClick={() => { setActiveDocument(null); setViewMode('chat'); }}
                className="p-1 text-white/40 hover:text-rose-400 rounded transition-colors ml-1"
                title="Close Document Panel"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <button
            onClick={() => setShowVoiceOrb(!showVoiceOrb)}
            className={`p-2 rounded-lg border transition-all text-xs flex items-center gap-1.5 ${
              showVoiceOrb ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/40 shadow-glow-purple' : 'bg-white/5 text-white/60 border-white/5 hover:text-white'
            }`}
            title="Toggle VoiceOrb Canvas Visualizer"
          >
            <Sparkles size={14} className={showVoiceOrb ? 'animate-spin' : ''} />
            <span className="hidden md:inline font-bold">VoiceOrb</span>
          </button>
        </div>
      </header>

      {/* ── Main Dynamic Workspace Body ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Floating VoiceOrb Drawer/Canvas Preview */}
        {showVoiceOrb && (
          <div className="absolute top-3 right-3 z-30 w-72 rounded-2xl bg-[#0b0818]/95 border border-cyber-purple/30 p-4 shadow-2xl backdrop-blur-xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span className="text-xs font-bold text-cyber-purple uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} /> Live VoiceOrb
              </span>
              <button onClick={() => setShowVoiceOrb(false)} className="text-white/40 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="w-48 h-48 my-1 flex items-center justify-center">
              <VoiceOrb 
                voiceState={isRecording ? 'listening' : isStreaming || isSttLoading ? 'thinking' : isSpeaking ? 'speaking' : 'idle'}
                analyserNode={audioAnalyser}
                size={180}
              />
            </div>
            <p className="text-[11px] text-white/40 font-mono mt-1">
              State: <span className="text-cyber-cyan font-bold uppercase">{isRecording ? 'listening' : isStreaming ? 'executing' : isSpeaking ? 'speaking' : 'idle'}</span>
            </p>
          </div>
        )}

        {/* LEFT COLUMN: Conversation & Real Agent Execution Area */}
        <div className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          viewMode === 'document' ? 'hidden' : viewMode === 'split' ? 'w-full lg:w-1/2 border-r border-white/5' : 'w-full'
        }`}>
          
          {/* Scrollable Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyber-purple to-cyber-cyan flex items-center justify-center shadow-glow-neon mb-4">
                  <Sparkles size={28} className="text-cyber-bg animate-pulse" />
                </div>
                <h2 className="text-2xl font-extrabold bg-gradient-to-r from-white via-white/90 to-cyber-cyan bg-clip-text text-transparent">
                  VANI AI Unified Workspace
                </h2>
                <p className="text-sm text-white/50 mt-2 leading-relaxed">
                  Voice AI + Enterprise BRD Business Analyst + Deep Web Research Agent. Speak or type to create complete product specs, live market analyses, or implementation blueprints.
                </p>

                {/* Quick Start Suggestions */}
                <div className="grid grid-cols-1 gap-2 mt-6 w-full text-left">
                  {[
                    "Vani, mere PG Finder startup ka detailed BRD bana do aur current competitors research karo.",
                    "Search current PG finder competitors and compare their pricing.",
                    "Explain React state management architecture.",
                    "Vani, explain normalization in DBMS."
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitStreamMessage(s)}
                      className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-cyber-cyan/30 text-xs text-white/80 transition-all flex items-center justify-between group"
                    >
                      <span className="truncate pr-2">"{s}"</span>
                      <Send size={12} className="text-white/20 group-hover:text-cyber-cyan shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 shadow-lg text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-cyber-purple/20 border border-cyber-purple/40 text-white rounded-br-sm' 
                      : 'bg-white/[0.03] border border-white/10 text-white/90 rounded-bl-sm w-full'
                  }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-white/5 text-[11px] text-white/40">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                        {msg.role === 'user' ? <User size={12} className="text-cyber-purple" /> : <Sparkles size={12} className="text-cyber-cyan" />}
                        {msg.role === 'user' ? 'You' : 'Vani AI'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Agent Activity Card (only if real execution occurred!) */}
                    {msg.agentExecution && (
                      <AgentActivityCard execution={msg.agentExecution} />
                    )}

                    {/* Generated Document Prompt Banner */}
                    {msg.documentId && (
                      <div className="my-3 p-3 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-cyber-cyan" />
                          <div>
                            <span className="font-bold text-xs text-white">{msg.documentTitle || 'Generated BRD Document'}</span>
                            <p className="text-[10px] text-white/50">29-section enterprise specification ready</p>
                          </div>
                        </div>
                        <button
                          onClick={() => loadDocument(msg.documentId)}
                          className="px-3 py-1.5 bg-cyber-cyan text-cyber-bg font-bold text-xs rounded-lg hover:bg-cyber-cyan/90 transition-all shrink-0 shadow-md"
                        >
                          Open in Workspace
                        </button>
                      </div>
                    )}

                    {/* Message Content */}
                    <div className="prose prose-invert prose-p:text-white/85 prose-headings:text-white prose-a:text-cyber-cyan max-w-none text-xs sm:text-sm">
                      <ReactMarkdown>{msg.content || (msg.isStreaming ? 'Thinking & reasoning with live intelligence...' : '')}</ReactMarkdown>
                    </div>

                    {/* Actions */}
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1.5 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors text-[11px] flex items-center gap-1"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => speakWithTTS(msg.content, currentLang, voiceSpeed)}
                          className="p-1.5 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors text-[11px] flex items-center gap-1"
                          title="Listen with Sarvam TTS"
                        >
                          <Volume2 size={12} /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Live Streaming Activity Card indicator */}
            {isStreaming && activeExecution && (
              <div className="w-full">
                <AgentActivityCard execution={activeExecution} isLive={true} />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Bottom Composer Area ────────────────────────────────────────── */}
          <div className="p-3 sm:p-4 border-t border-white/5 glass-panel z-20 shrink-0">
            {/* Live transcript banner */}
            {isRecording && liveTranscript && (
              <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/20 text-xs text-cyber-cyan italic flex items-center justify-between">
                <span>"{liveTranscript}"</span>
                <span className="text-[10px] text-white/40 font-mono">Listening · Auto-stops after silence</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 focus-within:border-cyber-cyan/40 transition-all shadow-xl">
              
              {/* Agent Selector Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80 transition-all"
                  title="Choose specialized Agent"
                >
                  <span>{currentAgentObj.icon}</span>
                  <span className="hidden sm:inline">{currentAgentObj.name}</span>
                  <ChevronDown size={11} className="text-white/40" />
                </button>

                {agentDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl bg-[#0e0a1f] border border-white/10 shadow-2xl p-2 z-50 max-h-72 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-2 py-1">
                      Select Agent
                    </div>
                    {CANONICAL_AGENTS.map(agent => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => { setSelectedAgent(agent.id); setAgentDropdownOpen(false); }}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-start gap-2.5 ${
                          selectedAgent === agent.id ? 'bg-cyber-cyan/15 text-white border border-cyber-cyan/30' : 'hover:bg-white/5 text-white/70'
                        }`}
                      >
                        <span className="text-base leading-none mt-0.5">{agent.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white">{agent.name}</p>
                          <p className="text-[10px] text-white/40 line-clamp-1">{agent.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Input Field */}
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ask Vani... (e.g. Create PG Finder BRD and research competitors)"
                className="flex-1 bg-transparent px-2.5 py-2 text-xs sm:text-sm text-white placeholder-white/25 focus:outline-none"
                disabled={isStreaming}
              />

              {/* Mic Button: Tap or Hold */}
              <button
                type="button"
                onClick={() => {
                  if (isRecording) stopRecording();
                  else startRecording('tap');
                }}
                className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
                  isRecording 
                    ? 'bg-rose-500 text-white animate-pulse shadow-glow-neon' 
                    : isSttLoading 
                    ? 'bg-amber-500/20 text-amber-300' 
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
                title={isRecording ? 'Listening (silence auto-stops)... Click to stop' : 'Click to speak'}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Send / Stop Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition-all flex items-center gap-1.5"
                >
                  <Square size={12} /> Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 btn-glow text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all"
                  title="Send Prompt"
                >
                  <Send size={15} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Document / BRD Workspace Viewer */}
        {activeDocument && (viewMode === 'split' || viewMode === 'document') && (
          <div className={`h-full overflow-hidden transition-all duration-300 ${
            viewMode === 'document' ? 'w-full' : 'w-full lg:w-1/2'
          }`}>
            <DocumentViewer
              document={activeDocument}
              onClosePreview={() => { setActiveDocument(null); setViewMode('chat'); }}
              onExport={(format) => {
                window.open(`/api/export/${activeDocument.id}/${format}`, '_blank');
              }}
            />
          </div>
        )}
      </div>

      {/* ── New Project Modal ─────────────────────────────────────────────── */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel border border-white/10 w-full max-w-md rounded-2xl bg-[#0e0a1f] p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowNewProjectModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
            <h3 className="text-base font-extrabold text-white mb-1">Create New Project</h3>
            <p className="text-xs text-white/40 mb-4">Scope your conversations, BRDs, research evidence, and implementation tasks.</p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="e.g. PG Finder App"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-cyan/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">Description (Optional)</label>
                <textarea
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  placeholder="Brief description of the product or startup goals..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-cyan/40 custom-scrollbar resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject || !newProjectName.trim()}
                  className="px-4 py-2 btn-glow text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40"
                >
                  {isCreatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
