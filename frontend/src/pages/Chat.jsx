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
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatHistory } from '../context/ChatHistoryContext';
import AgentActivityCard from '../components/AgentActivityCard';
import VoiceOrb from '../components/VoiceOrb';

const AGENT_OPTIONS = [
  { id: 'auto', label: '✨ Auto Agent', desc: 'Infers intent & selects agent automatically' },
  { id: 'brd', label: '📋 BRD Agent', desc: 'Generate 29-section BRD, research & tasks' },
  { id: 'prd', label: '📑 PRD Agent', desc: 'Create PRD with MoSCoW & RICE' },
  { id: 'research', label: '🌐 Research Agent', desc: 'Deep web research via TinyFish' },
  { id: 'technical_architect', label: '⚙ Technical Architect', desc: 'System design, database & APIs' },
  { id: 'startup', label: '🚀 Startup Copilot', desc: 'Business model & Lean canvas' },
  { id: 'task', label: '✓ Task Agent', desc: 'Manage implementation tasks' },
];

const Chat = ({ 
  currentLang, 
  voiceSpeed,
  voiceRecorder, 
  messages, 
  setMessages,
  onSubmitPrompt,
  autoSpeak = true
}) => {
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showVoiceOrb, setShowVoiceOrb] = useState(false);
  const [talkMode, setTalkMode] = useState('tap'); // 'tap' | 'hold'
  
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const dropdownRef = useRef(null);
  const { startNewSession, setCurrentSessionId, isLoggedIn } = useChatHistory();

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

  const getErrorMessage = (error) => {
    if (!error.response && error.message === 'Network Error') {
      return "Connection lost. Check your internet and try again.";
    }
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message;
    
    if (status === 429) return "Too many requests. Please wait a moment before trying again.";
    if (status === 503) return "AI services are temporarily busy. Try again in a few seconds.";
    if (status === 400 && msg?.toLowerCase().includes('audio')) return "No audio detected. Speak louder or closer to the mic.";
    return "Something went wrong. The backend may be offline.";
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Cache the last assistant message id
  const lastAssistantMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // STT race condition fix: wait for transcript promise
  useEffect(() => {
    if (!audioBlob) return;
    const waitAndSubmit = async () => {
      try {
        const text = await voiceRecorder.waitForTranscript();
        if (text) await submitMessage(text);
      } catch (err) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Couldn't hear you clearly, please try speaking again.",
          model: 'vani-simulator',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          simulated: true
        }]);
      } finally {
        resetAudioBlob?.();
      }
    };
    waitAndSubmit();
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Shared submit logic for both text and voice ──────────────────────────────
  const submitMessage = async (query) => {
    if (!query.trim() || isThinking) return;

    setInputText('');
    setIsThinking(true);
    cancelSpeech();

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const targetAgent = selectedAgent !== 'auto' ? selectedAgent : undefined;
      const response = await onSubmitPrompt(query, targetAgent);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: String(response?.response || response?.text || response?.message || 'Generated result ready.'),
        model: response?.model || (response?.simulated ? 'vani-simulator' : 'gemini-3.5-flash'),
        agentExecution: response?.agentExecution || null,
        documentId: response?.documentId || null,
        documentTitle: response?.documentTitle || null,
        tasks: response?.tasks || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: !!response?.simulated
      };

      setMessages(prev => [...prev, aiMsg]);

      // Auto-speak TTS response (respects user setting)
      if (autoSpeak && response.response) {
        speakWithTTS(response.response, currentLang, voiceSpeed);
      }

    } catch (err) {
      console.error('Failed to get answer:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: getErrorMessage(err),
        model: 'error',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: true
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Stop active generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelSpeech();
    setIsThinking(false);
  };

  // Handle Text Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    await submitMessage(inputText.trim());
  };

  // Replay speech synthesizer
  const handleReplay = (text) => {
    speakWithTTS(text, currentLang, voiceSpeed);
  };

  // Copy text to clipboard
  const handleCopy = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear chat
  const handleClearChat = () => {
    cancelSpeech();
    setMessages([]);
    if (isLoggedIn) setCurrentSessionId(null);
  };

  // Start a brand new chat session
  const handleNewChat = () => {
    cancelSpeech();
    setMessages([]);
    if (isLoggedIn) {
      startNewSession(currentLang);
    }
  };

  // Model badge label
  const getModelBadge = (msg) => {
    if (msg.simulated) return 'Vani Simulator';
    const m = (msg.model || '').toLowerCase();
    if (m.includes('gemini')) return 'Gemini 3.5 Flash';
    if (m.includes('gpt') || m.includes('openai')) return 'OpenAI GPT-4o';
    if (m.includes('sarvam')) return 'Sarvam Indic';
    return msg.model || 'AI';
  };

  const micIsActive = isRecording || isSttLoading;

  // Determine VoiceOrb state based on recorder
  const orbState = isRecording ? 'listening' : isThinking || isSttLoading ? 'thinking' : isSpeaking ? 'speaking' : 'idle';

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-bg relative overflow-hidden">
      
      {/* Header Panel with Agent Selector */}
      <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/5 flex items-center justify-between glass-panel z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5">
            <Sparkles size={15} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              Vani AI Copilot
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
            </h2>
            <p className="text-[10px] text-white/40 font-medium hidden sm:block">Multilingual Agentic Workspace</p>
          </div>
        </div>

        {/* Center: Agent Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-300 text-xs font-semibold transition-all"
          >
            <span>{AGENT_OPTIONS.find(a => a.id === selectedAgent)?.label || '✨ Auto Agent'}</span>
            <ChevronDown size={13} className={`transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {agentDropdownOpen && (
            <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-1.5 w-64 rounded-xl bg-[#0e0b1f] border border-white/10 shadow-2xl z-50 p-1.5 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Select Copilot Agent</div>
              {AGENT_OPTIONS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => { setSelectedAgent(agent.id); setAgentDropdownOpen(false); }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex flex-col ${
                    selectedAgent === agent.id 
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' 
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="font-semibold">{agent.label}</span>
                  <span className="text-[10px] text-white/40 mt-0.5">{agent.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowVoiceOrb(!showVoiceOrb)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              showVoiceOrb 
                ? 'bg-cyber-cyan/20 border-cyber-cyan/50 text-cyber-cyan' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
            title="Toggle Voice Orb"
          >
            <span className="text-xs">🎙 Orb</span>
          </button>

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-cyber-cyan/15 bg-cyber-cyan/5 hover:bg-cyber-cyan/15 text-cyber-cyan/70 hover:text-cyber-cyan text-xs font-bold transition-all"
            title="Start a new chat session"
            aria-label="Start a new chat session"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/10 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all"
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Voice Orb Floating Drawer if activated */}
      {showVoiceOrb && (
        <div className="w-full bg-[#070412]/95 border-b border-cyber-cyan/20 py-4 px-6 flex flex-col items-center justify-center relative z-10 transition-all shadow-xl">
          <div className="w-32 h-32 flex items-center justify-center">
            <VoiceOrb state={orbState} analyser={audioAnalyser} />
          </div>
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold text-white/90 capitalize">{orbState}...</p>
            <p className="text-[11px] text-white/40">
              {talkMode === 'tap' ? 'Tap mic below to speak · auto-stops on silence' : 'Hold mic to speak · release to send'}
            </p>
          </div>
        </div>
      )}

      {/* Main Conversation Thread Feed */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5">
              <Sparkles size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-extrabold text-white">Vani Business Copilot</h3>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                Ask a business question, generate a comprehensive 29-section BRD, research competitors with TinyFish live web access, or manage project tasks.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button 
                  onClick={() => submitMessage("Student PG finder startup ka detailed BRD banao aur current competitors research karo")}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-white/70 hover:text-white transition-all text-left"
                >
                  📋 "Student PG finder startup ka BRD banao"
                </button>
                <button 
                  onClick={() => submitMessage("Latest quick-commerce competitors and delivery model compare karo")}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-white/70 hover:text-white transition-all text-left"
                >
                  🌐 "Quick-commerce competitors compare karo"
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-bold flex-shrink-0 relative mt-0.5
                      ${isUser 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan' 
                        : 'bg-cyber-purple/10 border-cyber-purple/20 text-cyber-neonPurple'}
                    `}>
                      {isUser ? <User size={13} /> : 'V'}
                      {(!isUser && isSpeaking && msg.id === lastAssistantMsgId) && (
                        <div className="absolute -bottom-1 -right-1 bg-cyber-bg rounded-full p-[2px] flex items-center gap-[2px]">
                          <div className="w-1 h-[6px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-[10px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-[6px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>

                    {/* Chat Bubble & Agent Cards */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      
                      {/* Render Agent Execution Card if present */}
                      {!isUser && msg.agentExecution && (
                        <AgentActivityCard execution={msg.agentExecution} />
                      )}

                      <div className={`
                        px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-glass border text-sm leading-relaxed font-medium
                        ${isUser 
                          ? 'bg-gradient-to-tr from-cyber-purple/25 to-cyber-purple/10 border-cyber-purple/25 text-white rounded-tr-none' 
                          : 'bg-[#100d21] border-white/10 text-white/90 rounded-tl-none'}
                      `}>
                        {isUser ? (
                          msg.content
                        ) : (
                          <div className="prose prose-sm max-w-none text-white/90">
                            <ReactMarkdown
                              components={{
                                p: ({children}) => <p className="text-white/90 text-sm leading-relaxed my-1.5">{children}</p>,
                                strong: ({children}) => <strong className="text-cyber-cyan font-bold">{children}</strong>,
                                em: ({children}) => <em className="text-white/70 italic">{children}</em>,
                                li: ({children}) => <li className="text-white/80 text-sm ml-4 list-disc my-0.5">{children}</li>,
                                ul: ({children}) => <ul className="my-1.5 space-y-0.5">{children}</ul>,
                                ol: ({children}) => <ol className="my-1.5 space-y-0.5 list-decimal ml-4">{children}</ol>,
                                code: ({children, className, ...props}) => {
                                  const isBlock = /language-/.test(className || '');
                                  return isBlock
                                    ? <pre className="bg-black/40 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto"><code className="text-cyan-300 font-mono text-xs">{children}</code></pre>
                                    : <code className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-xs">{children}</code>;
                                },
                                h1: ({children}) => <h1 className="text-white font-bold text-base mt-2 mb-1">{children}</h1>,
                                h2: ({children}) => <h2 className="text-white font-bold text-sm mt-2 mb-1">{children}</h2>,
                                h3: ({children}) => <h3 className="text-white/80 font-semibold text-sm mt-1.5 mb-1">{children}</h3>,
                              }}
                            >
                              {String(msg.content || '')}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Footer Metadata */}
                      <div className={`flex items-center gap-2.5 px-1 text-[10px] text-white/40 font-medium ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <>
                            <span className="text-cyan-400 font-semibold bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                              {getModelBadge(msg)}
                            </span>
                            <button
                              onClick={() => handleReplay(msg.content)}
                              className="p-1 hover:text-cyan-400 transition-colors flex items-center gap-0.5"
                              title="Listen to response"
                              aria-label="Listen to response"
                            >
                              <Volume2 size={12} />
                              <span>Listen</span>
                            </button>
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="p-1 hover:text-cyan-400 transition-colors flex items-center gap-0.5"
                              title="Copy response"
                              aria-label="Copy response"
                            >
                              {copiedId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Live Thinking / Active Agent Execution Step Card */}
            {(isThinking || isSttLoading) && (
              <div className="flex justify-start">
                <div className="flex gap-2.5 sm:gap-3 items-start max-w-[92%] sm:max-w-[85%] w-full">
                  <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-neonPurple flex items-center justify-center font-bold text-xs mt-0.5">
                    V
                  </div>
                  <div className="flex-1 min-w-0">
                    <AgentActivityCard 
                      isLive={true}
                      execution={{
                        agentId: selectedAgent !== 'auto' ? selectedAgent : 'brd',
                        agentName: selectedAgent !== 'auto' ? AGENT_OPTIONS.find(a => a.id === selectedAgent)?.label : 'Agent Orchestrator',
                        plan: 'Executing goal with live intelligence...',
                        status: 'running',
                        providers: ['gemini'],
                        toolsUsed: ['tinyfish.search'],
                        steps: [
                          { step: 'intent', title: 'Understanding business context', status: 'completed' },
                          { step: 'research', title: 'Synthesizing knowledge & market signals', status: 'running', detail: 'Reasoning with Gemini 3.5 Flash' },
                          { step: 'output', title: 'Structuring response', status: 'pending' }
                        ]
                      }} 
                    />
                    <div className="flex items-center gap-2 text-xs text-white/50 pl-1 mt-1">
                      <span>Vani is analyzing your request...</span>
                      <span className="font-mono text-cyan-400 animate-pulse">▌</span>
                      <button
                        onClick={handleStop}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded"
                      >
                        <Square size={10} /> Stop
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-5 border-t border-white/5 glass-panel z-10 flex-shrink-0">
        {/* Live transcript preview while recording */}
        {isRecording && liveTranscript && (
          <div className="max-w-4xl mx-auto mb-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 italic flex items-center justify-between">
            <span>"{liveTranscript}"</span>
            <span className="text-[10px] text-cyan-400/60 font-mono">Max 5s · Auto-stop on silence</span>
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3 bg-white/[0.04] border border-white/10 p-1.5 sm:p-2 rounded-2xl focus-within:border-cyan-500/30 transition-all shadow-glass relative"
        >
          {/* Mic Button with Hold/Tap support */}
          <button
            type="button"
            onClick={() => {
              if (talkMode === 'tap') {
                if (isRecording) stopRecording('tap_stop');
                else startRecording('tap');
              }
            }}
            onMouseDown={() => {
              if (talkMode === 'hold') startRecording('hold');
            }}
            onMouseUp={() => {
              if (talkMode === 'hold') stopRecording('hold_release');
            }}
            onTouchStart={() => {
              if (talkMode === 'hold') startRecording('hold');
            }}
            onTouchEnd={() => {
              if (talkMode === 'hold') stopRecording('hold_release');
            }}
            disabled={isSttLoading}
            className={`
              p-2.5 sm:p-3 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 flex-shrink-0
              ${micIsActive
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20' 
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}
            `}
            title={
              isRecording 
                ? 'Listening... tap to send or speak naturally' 
                : `Click or hold to speak (${talkMode})`
            }
            aria-label="Microphone Voice Input"
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <input 
            id="chat-message-input"
            name="message"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording 
                ? 'Listening... (auto-stops on silence or 5s)' 
                : isSttLoading 
                ? 'Transcribing audio with Sarvam...' 
                : 'Ask Vani, create a BRD, research competitors...'
            }
            className="flex-1 bg-transparent px-2 text-sm text-white placeholder-white/30 focus:outline-none font-medium min-w-0"
            disabled={isRecording || isSttLoading}
          />

          {/* Mode switch (Tap / Hold) */}
          <button
            type="button"
            onClick={() => setTalkMode(talkMode === 'tap' ? 'hold' : 'tap')}
            className="hidden sm:inline-flex px-2 py-1 rounded text-[10px] uppercase font-bold text-white/40 hover:text-white/80 bg-white/5 border border-white/5"
            title="Switch talk mode between Tap-to-Talk and Hold-to-Talk"
          >
            {talkMode === 'tap' ? 'Tap' : 'Hold'}
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="p-2.5 sm:p-3 bg-cyber-purple hover:bg-cyber-purple/80 disabled:opacity-40 disabled:hover:bg-cyber-purple text-white rounded-xl transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
            title="Send prompt"
            aria-label="Send prompt"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
