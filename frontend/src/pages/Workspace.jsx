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
  Square,
  ChevronDown,
  Paperclip,
  FileText,
  X,
  Search,
  CheckSquare,
  Bot
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { PRIMARY_MODES, ADVANCED_AGENTS, getAgentDef } from '../config/canonicalAgents';
import AgentActivityCard from '../components/AgentActivityCard';
import VoiceOrb from '../components/VoiceOrb';
import DocumentViewer from '../components/DocumentViewer';
import CommandPalette from '../components/CommandPalette';
import CustomAgentModal from '../components/CustomAgentModal';
import ScheduledActionCard from '../components/ScheduledActionCard';
import EvidenceInspector from '../components/EvidenceInspector';

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

  // Dynamic Agent Transition & Session Continuity (Chat-to-Agent Evolution)
  const [agentTransition, setAgentTransition] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem('vani_active_session_id') || '');
  const [evidenceInspectorData, setEvidenceInspectorData] = useState(null);

  // Section 10: Follow-up Queue
  const [queuedInstructions, setQueuedInstructions] = useState([]);

  // Section 19 & 20: Command Palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Section 9: Plan Mode State
  const [proposedPlan, setProposedPlan] = useState(null);

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

  // Active streaming state & last prompt
  const [activeExecution, setActiveExecution] = useState(null);
  const lastUserPromptRef = useRef('');
  const abortControllerRef = useRef(null);
  const chatEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const projectDropdownRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  const adjustTextareaHeight = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 44), 160)}px`;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        content: event.target?.result || ''
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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

  // Time-aware greeting for minimal home screen (Section 2)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Active project metrics
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const activeProjectDocCount = activeProject?._count?.documents ?? (activeProject?.documents?.length || 0);
  const activeProjectTaskCount = activeProject?._count?.tasks ?? 0;

  const location = useLocation();

  // Custom Agents State (Section 25 & 26)
  const [customAgents, setCustomAgents] = useState([]);
  const [showCustomAgentModal, setShowCustomAgentModal] = useState(false);

  const fetchCustomAgents = async () => {
    try {
      const res = await axios.get('/api/agents/custom', { withCredentials: true });
      if (Array.isArray(res.data)) {
        setCustomAgents(res.data);
      }
    } catch (err) {
      console.warn('Failed to load custom agents:', err.message);
    }
  };

  useEffect(() => {
    fetchCustomAgents();
  }, []);

  // Restore session state for persistent context continuity (Section 8, 10, 86)
  useEffect(() => {
    if (!activeSessionId) return;
    const restoreSession = async () => {
      try {
        const res = await axios.get(`/api/ai/session/${activeSessionId}/state`, { withCredentials: true });
        if (res.data?.session) {
          const sess = res.data.session;
          if (Array.isArray(sess.messages) && sess.messages.length > 0 && messages.length === 0) {
            setMessages(sess.messages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          }
          if (sess.currentMode && sess.currentMode !== 'auto') {
            setSelectedAgent(sess.currentMode);
          }
          if (sess.artifactState) {
            try {
              const parsedArtifact = typeof sess.artifactState === 'string' ? JSON.parse(sess.artifactState) : sess.artifactState;
              setActiveDocument(parsedArtifact);
            } catch (e) {}
          }
          if (sess.agentRuns?.length > 0) {
            const latestRun = sess.agentRuns[0];
            setActiveExecution({
              agentId: latestRun.agentId,
              status: latestRun.status,
              steps: latestRun.steps || []
            });
          }
        }
      } catch (err) {
        console.warn('[Session Restore Warn]:', err.message);
      }
    };
    restoreSession();
  }, [activeSessionId]);

  // Selected agent definition (supports both canonical & custom agents)
  const selectedAgentDef = useMemo(() => {
    if (selectedAgent?.startsWith('custom_')) {
      const customId = selectedAgent.replace('custom_', '');
      const found = customAgents.find(a => a.id === customId);
      if (found) {
        return {
          id: selectedAgent,
          name: found.name,
          icon: '🧠',
          description: found.description || 'Custom autonomous agent',
          capabilities: Array.isArray(found.tools) ? found.tools : [],
          preferredProvider: found.preferredModel || 'auto',
          tools: Array.isArray(found.tools) ? found.tools : []
        };
      }
    }
    return getAgentDef(selectedAgent);
  }, [selectedAgent, customAgents]);

  // ─── Fetch User Projects ──────────────────────────────────────────────────
  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects', { withCredentials: true });
      if (Array.isArray(res.data)) {
        setProjects(res.data);
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

  // Synchronize state with URL query params ?projectId= & ?agent= (Section 46)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pId = params.get('projectId');
    if (pId && pId !== selectedProjectId) {
      setSelectedProjectId(pId);
      localStorage.setItem('vani_active_project_id', pId);
    }
    const aId = params.get('agent');
    if (aId && aId !== selectedAgent) {
      setSelectedAgent(aId);
    }
  }, [location.search]);

  const handleSelectProject = (projId) => {
    setSelectedProjectId(projId);
    localStorage.setItem('vani_active_project_id', projId);
    setProjectDropdownOpen(false);
    // Sync URL without reload
    const url = new URL(window.location);
    if (projId) url.searchParams.set('projectId', projId);
    else url.searchParams.delete('projectId');
    window.history.replaceState({}, '', url);
  };

  const handleSelectAgent = (agentId) => {
    setSelectedAgent(agentId);
    setAgentDropdownOpen(false);
    // Sync URL without reload
    const url = new URL(window.location);
    if (agentId && agentId !== 'auto') url.searchParams.set('agent', agentId);
    else url.searchParams.delete('agent');
    window.history.replaceState({}, '', url);
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
  }, [messages, isStreaming, activeExecution, queuedInstructions]);

  // STT Auto-submit hook with VAD
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
    let prompt = queryText.trim();
    if (!prompt && !attachedFile) return;

    if (attachedFile) {
      prompt = `${prompt ? prompt + '\n\n' : ''}[Attached File: ${attachedFile.name}]\n${attachedFile.content}`.trim();
      setAttachedFile(null);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Section 10: If already streaming, add to queued instructions!
    if (isStreaming) {
      setQueuedInstructions(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setInputText('');
      return;
    }

    lastUserPromptRef.current = prompt;
    setInputText('');
    cancelSpeech?.();
    setIsStreaming(true);
    setActiveExecution(null);
    setProposedPlan(null);

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
        sessionId: activeSessionId || undefined,
        agentType: selectedAgent !== 'auto' ? selectedAgent : undefined,
        projectId: selectedProjectId || undefined,
        language_code: currentLang || 'hi-IN',
        personality: personality || 'respectful',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
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
      let streamExecutionError = null;

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

            // Dynamic Agent Transition & Scheduled Action handling
            if (event.type === 'agent.transition') {
              setAgentTransition({
                fromMode: event.fromMode,
                toMode: event.toMode,
                agent: event.agent,
                reason: event.reason,
                capabilities: event.capabilities
              });
              setTimeout(() => setAgentTransition(null), 6000);
            } else if (event.type === 'action.scheduled') {
              const scheduledAction = event.action;
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                ...m,
                scheduledAction
              } : m));
            } else if (event.type === 'agent.started') {
              if (event.sessionId) {
                setActiveSessionId(event.sessionId);
                localStorage.setItem('vani_active_session_id', event.sessionId);
              }
              currentExecution = {
                agentId: event.agent,
                agentName: event.name || event.agentName,
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
              if (event.sessionId) {
                setActiveSessionId(event.sessionId);
                localStorage.setItem('vani_active_session_id', event.sessionId);
              }
              if (event.result?.scheduledAction) {
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                  ...m,
                  scheduledAction: event.result.scheduledAction
                } : m));
              }
            } else if (event.type === 'error') {
              streamExecutionError = event.error || event.message || 'Execution encountered an error';
              if (currentExecution) {
                currentExecution.status = 'failed';
                currentExecution.error = streamExecutionError;
                setActiveExecution({ ...currentExecution });
              }
              break;
            }
          } catch (jsonErr) {
            console.warn('[SSE Parse Warn]:', jsonErr.message);
          }
        }
      }

      // Finalize assistant message
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          if (streamExecutionError) {
            return {
              ...m,
              content: `⚠️ ${streamExecutionError}`,
              isError: true,
              agentExecution: currentExecution ? { ...currentExecution, status: 'failed', error: streamExecutionError } : null,
              isStreaming: false
            };
          }
          const finalContent = accumulatedText || finalResultPayload?.response || finalResultPayload?.text || 'Generated result ready.';
          const scheduledAction = finalResultPayload?.scheduledAction || m.scheduledAction || null;
          return {
            ...m,
            content: finalContent,
            agentExecution: currentExecution,
            documentId: finalResultPayload?.documentId || currentExecution?.documentId || null,
            documentTitle: finalResultPayload?.documentTitle || currentExecution?.documentTitle || null,
            tasks: finalResultPayload?.tasks || [],
            scheduledAction,
            isStreaming: false
          };
        }
        return m;
      }));

      // Auto-speak response via Sarvam TTS if configured
      const speechText = finalResultPayload?.response || accumulatedText;
      if (autoSpeak && speechText && !streamExecutionError) {
        speakWithTTS(speechText, currentLang, voiceSpeed);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
        if (activeExecution) {
          setActiveExecution(prev => prev ? { ...prev, status: 'stopped' } : null);
        }
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

      // Section 10: Auto-process next queued follow-up instruction!
      setQueuedInstructions(prev => {
        if (prev.length > 0) {
          const [nextTask, ...remaining] = prev;
          setTimeout(() => submitStreamMessage(nextTask.prompt), 150);
          return remaining;
        }
        return prev;
      });
    }
  };

  // Section 8: Stop & Retry controls
  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  const handleRetryExecution = () => {
    if (lastUserPromptRef.current) {
      submitStreamMessage(lastUserPromptRef.current);
    }
  };

  // Section 14: Contextual Ask Vani from Artifact
  const handleAskVaniFromArtifact = (item) => {
    const questionPrompt = item.prompt || `Explain the design rationale and key requirements for "${item.title || item.id}".`;
    submitStreamMessage(questionPrompt);
    setViewMode('split');
  };

  // Section 15: Post-generation Follow-up Actions
  const handleFollowUpAction = (action, prompt) => {
    if (prompt) {
      submitStreamMessage(prompt);
    }
  };

  // Copy to clipboard helper
  const handleCopyMessage = (id, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07050F] text-[#F8F7FF] overflow-hidden relative font-sans">

      {/* ── Top Context Bar (Section 24) ──────────────────────────────────── */}
      <header className="px-4 py-2.5 border-b border-white/10 bg-[#0B0914]/80 backdrop-blur-md flex items-center justify-between z-20 shrink-0 gap-3">
        {/* Left: Project Selector */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative" ref={projectDropdownRef}>
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-white transition-all shadow-sm max-w-[200px] truncate"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeProject ? 'bg-cyan-400' : 'bg-slate-500'}`} />
              <span className="truncate">{activeProject ? activeProject.name : 'No Project Selected'}</span>
              <ChevronDown size={13} className="text-white/40 shrink-0 ml-1" />
            </button>

            {projectDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-[#0F172A] border border-white/10 shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2 py-1">
                  Active Projects
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar my-1">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all ${
                        selectedProjectId === p.id ? 'bg-cyan-500/15 text-cyan-300 font-bold' : 'hover:bg-white/5 text-white/80'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {selectedProjectId === p.id && <Check size={13} className="text-cyan-400 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-1 mt-1">
                  <button
                    onClick={() => { setProjectDropdownOpen(false); setShowNewProjectModal(true); }}
                    className="w-full text-left p-2 rounded-xl text-cyan-400 hover:bg-cyan-500/10 font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={13} /> Create New Project
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Context Metrics Badges: Suppress zero metrics if no project selected */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-white/50 pl-2 border-l border-white/10">
            {activeProject ? (
              <>
                <span className="flex items-center gap-1">
                  <FileText size={12} className="text-white/40" />
                  <span><strong className="text-white">{activeProjectDocCount}</strong> Docs</span>
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <Globe size={12} className="text-cyan-400" />
                  <span><strong className="text-white">{activeDocument?.metadata?.sources?.length || 0}</strong> Research</span>
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <CheckSquare size={12} className="text-emerald-400" />
                  <span><strong className="text-white">{activeProjectTaskCount}</strong> Tasks</span>
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">
                General Workspace (No project context)
              </span>
            )}

            {/* Run Status Indicator */}
            {(isStreaming || activeExecution) && (
              <>
                <span className="text-white/20">•</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] uppercase font-bold flex items-center gap-1 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{isStreaming ? 'Executing...' : activeExecution?.status || 'Active'}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Toolbar: Global Search, View Switcher & VoiceOrb */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Global Search Button (Section 19) */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 text-xs text-white/60 hover:text-white transition-all shadow-sm"
            title="Search Vani (Ctrl+K / Cmd+K)"
          >
            <Search size={13} className="text-cyber-cyan" />
            <span className="hidden sm:inline">Search Vani...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/50">⌘K</kbd>
          </button>

          {/* View Mode Switcher (if document active) */}
          {activeDocument && (
            <div className="hidden sm:flex items-center bg-white/[0.03] border border-white/10 p-0.5 rounded-xl text-xs">
              <button
                onClick={() => setViewMode('chat')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === 'chat' ? 'bg-white/10 text-white font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === 'split' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('document')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === 'document' ? 'bg-cyber-cyan/20 text-cyber-cyan font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                Doc
              </button>
              <button
                onClick={() => { setActiveDocument(null); setViewMode('chat'); }}
                className="p-1 text-white/40 hover:text-rose-400 rounded transition-colors ml-1"
                title="Close Document"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* VoiceOrb Visualizer Button */}
          <button
            onClick={() => setShowVoiceOrb(!showVoiceOrb)}
            className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
              showVoiceOrb ? 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/40 shadow-glow-purple' : 'bg-white/[0.03] text-white/60 border-white/5 hover:text-white'
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
          <div className="absolute top-3 right-3 z-30 w-72 rounded-2xl bg-[#0b0818]/95 border border-cyber-purple/30 p-4 shadow-2xl backdrop-blur-xl flex flex-col items-center animate-in fade-in zoom-in-95">
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
                voiceState={
                  isRecording 
                    ? 'listening' 
                    : isSttLoading 
                    ? 'processing' 
                    : isStreaming 
                    ? (activeExecution?.toolsUsed?.includes('tinyfish.search') ? 'researching' : 'thinking')
                    : isSpeaking 
                    ? 'speaking' 
                    : 'idle'
                }
                analyserNode={audioAnalyser}
                size={180}
              />
            </div>
            <p className="text-[11px] text-white/50 font-mono mt-1">
              State: <span className="text-cyber-cyan font-bold uppercase">{
                isRecording ? 'listening' : isSttLoading ? 'processing' : isStreaming ? 'executing' : isSpeaking ? 'speaking' : 'idle'
              }</span>
            </p>
          </div>
        )}

        {/* LEFT COLUMN: Conversation & Real Agent Execution Stream (55% desktop) */}
        <div className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          viewMode === 'document' ? 'hidden' : viewMode === 'split' ? 'w-full lg:w-[55%] border-r border-white/10' : 'w-full'
        }`}>
          
          {/* Scrollable Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              /* ── Default Home / Minimal General Chat (Section 10) ────────── */
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-2xl mx-auto py-8 px-4">
                
                {/* Greeting & Subtitle */}
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  {greeting}
                </h1>
                <p className="text-sm text-slate-400 mt-2 font-medium max-w-md">
                  India-first, multilingual, voice-first AI work copilot. Speak or type in Hindi, Hinglish, or English.
                </p>

                {/* Project Context Indicator */}
                <div className="mt-4 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300 flex items-center gap-2 shadow-sm">
                  <span className={`w-2 h-2 rounded-full ${activeProject ? 'bg-cyan-400' : 'bg-slate-500'}`} />
                  <span>{activeProject ? (
                    <>Project: <strong className="text-white">{activeProject.name}</strong></>
                  ) : (
                    'General Workspace (No project selected)'
                  )}</span>
                </div>

                {/* 3 Prominent Starter Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 w-full">
                  <button
                    onClick={() => submitStreamMessage('Namaste Vani! Explain the key benefits of using AI for everyday work in simple terms.')}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-500/40 text-left transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
                        <span className="text-base">💬</span>
                      </div>
                      <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">Ask Vani</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Fast everyday questions, ideas, or code in Hindi, Hinglish, or English.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-cyan-400 mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Try now →
                    </span>
                  </button>

                  <button
                    onClick={() => submitStreamMessage('Research current market trends, competitors, and pricing models for a student PG finder startup in India.')}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-500/40 text-left transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                        <span className="text-base">🔎</span>
                      </div>
                      <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">Research Competitors</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Live web search, competitor analysis, pricing, and market demand.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-400 mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Research →
                    </span>
                  </button>

                  <button
                    onClick={() => submitStreamMessage('Create a comprehensive 29-section Enterprise BRD for an on-demand quick-commerce service.')}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/40 text-left transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                        <span className="text-base">📋</span>
                      </div>
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">Create a BRD</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        29-section Enterprise Business Requirements Document with live evidence.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 mt-3 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Generate →
                    </span>
                  </button>
                </div>

                {/* Compact, Discoverable Voice Control */}
                <button
                  onClick={isRecording ? stopRecording : () => startRecording()}
                  className={`mt-6 px-4 py-2 rounded-full border text-xs font-semibold transition-all flex items-center gap-2 shadow-sm ${
                    isRecording 
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300 hover:text-white'
                  }`}
                  title={isRecording ? 'Click to stop listening' : 'Click to speak with Vani'}
                >
                  <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-cyan-400'}`} />
                  <span>{isRecording ? 'Listening (Click to Stop)' : 'Voice Mode · Click to Speak'}</span>
                </button>

              </div>
            ) : (
              <>
                {/* Dynamic Agent Transition Notice (Section 6 & 34) */}
                {agentTransition && (
                  <div className="mx-2 mb-3 p-3 rounded-2xl bg-[#0F0C1E] border border-cyan-500/30 text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="font-bold text-white tracking-wide">
                          ✦ Vani switched to {agentTransition.agent ? agentTransition.agent.toUpperCase() : 'Specialized Agent'}
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-400/80 font-mono uppercase bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                        Auto Transition
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 mt-1 pl-4">
                      {agentTransition.reason || 'Live capabilities activated for this request.'}
                    </p>
                  </div>
                )}

                {/* ── Conversation Message Bubbles ─────────────────────────── */}
                {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 shadow-lg text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-cyber-purple/20 border border-cyber-purple/40 text-white rounded-br-sm' 
                      : 'bg-white/[0.03] border border-white/10 text-white/90 rounded-bl-sm w-full'
                  }`}>
                    {/* Message Header */}
                    <div className="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-white/5 text-[11px] text-white/40">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                        {msg.role === 'user' ? <User size={12} className="text-cyber-purple" /> : <Sparkles size={12} className="text-cyber-cyan" />}
                        {msg.role === 'user' ? 'You' : 'Vani AI'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Agent Activity Card (only if real execution occurred!) */}
                    {msg.agentExecution && (
                      <AgentActivityCard 
                        execution={msg.agentExecution} 
                        onStop={handleStopExecution}
                        onRetry={handleRetryExecution}
                        onInspectEvidence={(data) => setEvidenceInspectorData(data)}
                      />
                    )}

                    {/* Inline Scheduled Action Card (Section 18, 24) */}
                    {msg.scheduledAction && (
                      <ScheduledActionCard
                        action={msg.scheduledAction}
                        onActionUpdated={(updated) => {
                          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, scheduledAction: updated } : m));
                        }}
                        onActionDeleted={() => {
                          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, scheduledAction: null } : m));
                        }}
                      />
                    )}

                    {/* Generated Document Banner */}
                    {msg.documentId && (
                      <div className="my-3 p-3.5 rounded-2xl bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <FileText size={18} className="text-cyber-cyan" />
                          <div>
                            <span className="font-bold text-xs text-white">{msg.documentTitle || 'Enterprise BRD Document'}</span>
                            <p className="text-[10px] text-white/50">29-section enterprise specification ready</p>
                          </div>
                        </div>
                        <button
                          onClick={() => loadDocument(msg.documentId)}
                          className="px-3.5 py-1.5 bg-cyber-cyan text-cyber-bg font-bold text-xs rounded-xl hover:bg-cyber-cyan/90 transition-all shrink-0 shadow-md"
                        >
                          Open in Workspace
                        </button>
                      </div>
                    )}

                    {/* Markdown Body */}
                    <div className="prose prose-invert max-w-none text-white/90 text-sm leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {/* Action Toolbar */}
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5 text-xs text-white/40">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="p-1 hover:text-white rounded transition-colors flex items-center gap-1"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            <span className="text-[11px]">{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => speakWithTTS(msg.content, currentLang, voiceSpeed)}
                            className="p-1 hover:text-cyber-cyan rounded transition-colors flex items-center gap-1"
                            title="Speak with Sarvam TTS"
                          >
                            <Volume2 size={13} />
                            <span className="text-[11px]">Listen</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={chatEndRef} />
          </div>

          {/* ── Follow-Up Queue Floating Bar (Section 10) ──────────────────── */}
          {queuedInstructions.length > 0 && (
            <div className="px-4 py-2 bg-cyber-purple/20 border-t border-cyber-purple/40 backdrop-blur-md flex items-center justify-between text-xs text-white animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-cyber-purple animate-ping shrink-0" />
                <span className="font-bold text-cyber-purple">Queued ({queuedInstructions.length}):</span>
                <span className="truncate italic text-white/80">"{queuedInstructions[0].prompt}"</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <button
                  onClick={() => setQueuedInstructions(prev => prev.slice(1))}
                  className="p-1 text-white/60 hover:text-rose-400 rounded transition-colors"
                  title="Remove from queue"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* ── Chat Composer & Simplified Mode Selector (Section 5) ──────── */}
          <div className="p-3 sm:p-4 bg-[#090714]/90 border-t border-white/10 backdrop-blur-lg">
            
            {/* Mode Selector (Section 5 & 8: Auto, Chat, Research, Plan, Build + My Agents & More) */}
            <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
              {PRIMARY_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleSelectAgent(mode.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedAgent === mode.id
                      ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
                      : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{mode.icon}</span>
                  <span>{mode.name}</span>
                </button>
              ))}

              {/* More Agents & Custom Agents Dropdown (Section 8 & 25) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    !PRIMARY_MODES.some(m => m.id === selectedAgent)
                      ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40 shadow-sm'
                      : 'bg-white/[0.03] text-white/50 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{!PRIMARY_MODES.some(m => m.id === selectedAgent) ? `${selectedAgentDef.icon} ${selectedAgentDef.name}` : 'More Agents →'}</span>
                  <ChevronDown size={12} />
                </button>

                {agentDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-[#0F0C1E] border border-white/10 shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 max-h-72 overflow-y-auto custom-scrollbar">
                    
                    {/* Section: My Custom Agents */}
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5 mb-1">
                      <span className="text-[10px] font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1">
                        <Bot size={11} /> My Agents ({customAgents.length})
                      </span>
                      <button
                        onClick={() => { setAgentDropdownOpen(false); setShowCustomAgentModal(true); }}
                        className="text-[10px] font-bold text-cyber-purple hover:text-cyber-cyan transition-colors flex items-center gap-0.5"
                      >
                        <Plus size={11} /> Create
                      </button>
                    </div>

                    {customAgents.length > 0 ? (
                      <div className="space-y-1 mb-2">
                        {customAgents.map(ca => {
                          const caId = `custom_${ca.id}`;
                          const isSelected = selectedAgent === caId;
                          return (
                            <button
                              key={ca.id}
                              onClick={() => handleSelectAgent(caId)}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all ${
                                isSelected ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:bg-white/5 text-white/80'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                  <span>🧠</span>
                                  <span>{ca.name}</span>
                                </div>
                                {ca.description && (
                                  <div className="text-[10px] text-white/40 truncate">{ca.description}</div>
                                )}
                              </div>
                              {isSelected && <Check size={13} className="text-cyan-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-[11px] text-white/40 text-center italic mb-1">
                        No custom agents yet. Click "+ Create" above.
                      </div>
                    )}

                    {/* Section: Advanced Canonical Agents */}
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2 py-1 border-t border-white/5 pt-1.5">
                      Advanced Agents
                    </div>
                    {ADVANCED_AGENTS.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent.id)}
                        className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all ${
                          selectedAgent === agent.id ? 'bg-cyber-purple/20 text-cyber-purple font-bold' : 'hover:bg-white/5 text-white/80'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white">{agent.icon} {agent.name}</div>
                          <div className="text-[10px] text-white/40">{agent.desc}</div>
                        </div>
                        {selectedAgent === agent.id && <Check size={13} className="text-cyber-purple shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Attached file preview chip */}
            {attachedFile && (
              <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300">
                <Paperclip size={13} className="shrink-0" />
                <span className="font-semibold truncate max-w-[200px]">{attachedFile.name}</span>
                <span className="text-[10px] text-cyan-400/60 font-mono">({Math.round(attachedFile.size / 1024)} KB)</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-0.5 hover:text-white rounded ml-1"
                  title="Remove attachment"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Input Composer Box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if ((inputText.trim() || attachedFile) && !isStreaming) {
                  submitStreamMessage(inputText);
                }
              }}
              className="flex items-end gap-2 bg-white/[0.03] border border-white/10 rounded-2xl p-2 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30 transition-all shadow-inner"
            >
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all shrink-0 mb-0.5"
                title="Attach file (Text, Markdown, JSON, CSV)"
              >
                <Paperclip size={18} />
              </button>

              {/* Multiline Auto-resizing Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  adjustTextareaHeight(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((inputText.trim() || attachedFile) && !isStreaming) {
                      submitStreamMessage(inputText);
                    }
                  }
                }}
                placeholder={
                  selectedAgent === 'research'
                    ? "Ask Vani to research competitors, pricing, or market trends..."
                    : selectedAgent === 'build'
                    ? "Tell Vani what MVP to build..."
                    : selectedAgent === 'plan'
                    ? "Tell Vani what task to plan..."
                    : "Ask Vani anything or speak naturally (Shift+Enter for newline)..."
                }
                className="flex-1 bg-transparent px-2 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none resize-none max-h-40 min-h-[38px] leading-relaxed custom-scrollbar"
              />

              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : () => startRecording()}
                className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 mb-0.5 ${
                  isRecording 
                    ? 'bg-rose-500 text-white animate-pulse shadow-md' 
                    : 'text-slate-400 hover:text-cyan-400 hover:bg-white/5'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Voice Input (Sarvam Saaras v4)'}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Send or Stop button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopExecution}
                  className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition-all shrink-0 border border-rose-500/40 mb-0.5"
                  title="Stop generation"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !attachedFile) || isStreaming}
                  className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 mb-0.5 ${
                    (inputText.trim() || attachedFile) && !isStreaming
                      ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md hover:opacity-90' 
                      : 'text-white/20 bg-white/5 cursor-not-allowed'
                  }`}
                  title="Send instruction (Enter)"
                >
                  <Send size={16} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Document & Artifact Workspace (45% desktop, toggleable) */}
        {activeDocument && viewMode !== 'chat' && (
          <div className={`h-full transition-all duration-300 ${
            viewMode === 'document' ? 'w-full' : 'w-full lg:w-[45%]'
          }`}>
            <DocumentViewer
              document={activeDocument}
              projectTasks={activeDocument.tasks || []}
              onAskVani={handleAskVaniFromArtifact}
              onFollowUpAction={handleFollowUpAction}
              onConvertToPrd={() => submitStreamMessage(`Convert "${activeDocument.title}" into a complete Product Requirements Document (PRD).`)}
              onExport={(format) => {
                if (format === 'markdown') {
                  const blob = new Blob([activeDocument.content || ''], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = window.document.createElement('a');
                  a.href = url;
                  a.download = `${activeDocument.title || 'document'}.md`;
                  a.click();
                } else if (format === 'json') {
                  const blob = new Blob([JSON.stringify(activeDocument, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = window.document.createElement('a');
                  a.href = url;
                  a.download = `${activeDocument.title || 'document'}.json`;
                  a.click();
                }
              }}
              onClosePreview={() => { setActiveDocument(null); setViewMode('chat'); }}
            />
          </div>
        )}
      </div>

      {/* ── New Project Modal ──────────────────────────────────────────────── */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0F0C1E] border border-white/10 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Create New Project Workspace</h3>
            <p className="text-xs text-white/50 mb-4">
              Projects maintain dedicated memory across BRDs, PRDs, research evidence, and implementation tasks.
            </p>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Student PG Finder"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Description (Optional)</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Briefly describe the startup problem or objective..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan resize-none h-20"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject || !newProjectName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-purple to-cyber-cyan text-white text-xs font-bold shadow-md hover:opacity-90"
                >
                  {isCreatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Global Command Palette (Section 51 & 52) ────────────────────────── */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNewChat={() => {
          setMessages([]);
          setActiveDocument(null);
          setActiveExecution(null);
          setInputText('');
        }}
        onNewProject={() => setShowNewProjectModal(true)}
        onSelectProject={(projId) => handleSelectProject(projId)}
        onOpenDocument={(doc) => {
          setActiveDocument(doc);
          setViewMode('document');
        }}
        onSwitchMode={(modeId) => handleSelectAgent(modeId)}
        onToggleVoice={() => {
          if (isRecording) stopRecording();
          else startRecording();
        }}
        onOpenSettings={() => {
          window.location.href = '/settings';
        }}
        onOpenCustomAgentModal={() => setShowCustomAgentModal(true)}
        onOpenTasks={() => {
          if (activeDocument) {
            setViewMode('document');
          }
        }}
        onOpenDocuments={() => {
          if (activeProject?.documents?.length > 0) {
            setActiveDocument(activeProject.documents[0]);
            setViewMode('document');
          }
        }}
      />

      {/* ── Custom Agent Builder Modal (Section 25 & 26) ────────────────────── */}
      <CustomAgentModal
        isOpen={showCustomAgentModal}
        onClose={() => setShowCustomAgentModal(false)}
        onAgentCreated={(newAgent) => {
          fetchCustomAgents();
          handleSelectAgent(`custom_${newAgent.id}`);
        }}
      />

      {/* ── Evidence Inspector Modal (Section 80) ─────────────────────────── */}
      <EvidenceInspector
        isOpen={Boolean(evidenceInspectorData)}
        sources={evidenceInspectorData?.sources || []}
        claims={evidenceInspectorData?.claims || []}
        onClose={() => setEvidenceInspectorData(null)}
      />
    </div>
  );
}
