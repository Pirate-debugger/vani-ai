import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Mic, MicOff, Volume2, Sparkles, User, Trash2, Plus, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatHistory } from '../context/ChatHistoryContext';

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
  const chatEndRef = useRef(null);
  const { startNewSession, setCurrentSessionId, isLoggedIn } = useChatHistory();

  const {
    isRecording,
    isSttLoading,
    isSpeaking,
    transcript,
    liveTranscript,
    audioBlob,
    startRecording,
    stopRecording,
    speakWithTTS,
    cancelSpeech,
    resetAudioBlob
  } = voiceRecorder;

  const getErrorMessage = (error) => {
    if (!error.response && error.message === 'Network Error') {
      return "Connection lost. Check your internet and try again.";
    }
    const status = error.response?.status;
    const msg = error.response?.data?.error || error.message;
    
    if (status === 429) return "Too many requests. Please wait a moment before trying again.";
    if (status === 503) return "Sarvam AI service is temporarily unavailable. Try again in a few seconds.";
    if (status === 400 && msg?.toLowerCase().includes('audio')) return "No audio detected. Try speaking louder or closer to the mic.";
    return "Something went wrong. The backend may be offline.";
  };

  // Cache the last assistant message id to avoid O(n) reverse+find in every render
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
          content: "Couldn't hear you clearly, please try again",
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

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await onSubmitPrompt(query);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: String(response?.response || response?.text || response?.message || 'I could not understand the response. Please try again.'),
        model: response?.model || (response?.simulated ? 'vani-simulator' : 'sarvam'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: !!response?.simulated
      };

      setMessages(prev => [...prev, aiMsg]);

      // Auto-speak TTS response (respects user setting)
      if (autoSpeak) {
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

  // Clear chat
  const handleClearChat = () => {
    cancelSpeech();
    setMessages([]);
    // Reset session so next message starts a fresh one
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

  // ─── Fix: correct model badge label ─────────────────────────────────────────
  const getModelBadge = (msg) => {
    if (msg.simulated) return 'Vani·Sim';
    const m = (msg.model || '').toLowerCase();
    if (m.includes('sarvam')) return m.includes('105') ? 'Sarvam·105B' : 'Sarvam·30B';
    if (m.includes('gemini')) return 'Gemini·2.5';
    if (m.includes('gpt')) return 'GPT·4o';
    return msg.model || 'AI';
  };

  const micIsActive = isRecording || isSttLoading;

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-bg relative overflow-hidden">
      
      {/* Header Panel */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between glass-panel z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyber-purple/20 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5">
            <Sparkles size={14} />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold text-white">Vani Chat Dialog</h2>
            <p className="text-[9px] sm:text-[10px] text-white/40 font-medium hidden sm:block">Conversational Memory Active</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-cyber-cyan/15 bg-cyber-cyan/5 hover:bg-cyber-cyan/15 text-cyber-cyan/70 hover:text-cyber-cyan text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New Chat</span>
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-red-500/10 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Thread Feed */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5 animate-pulse">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">No active history</h3>
              <p className="text-xs text-white/40 max-w-xs mt-1 leading-relaxed">
                Type a prompt below or tap the microphone to speak your message.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-float-slow group`}>
                  <div className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Icon/Avatar */}
                    <div className={`
                      w-7 h-7 sm:w-8 sm:h-8 min-w-7 sm:min-w-8 rounded-lg flex items-center justify-center border text-xs font-bold flex-shrink-0 relative
                      ${isUser 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan' 
                        : 'bg-cyber-purple/10 border-cyber-purple/20 text-cyber-neonPurple'}
                    `}>
                      {isUser ? <User size={12} /> : 'V'}
                      {(!isUser && isSpeaking && msg.id === lastAssistantMsgId) && (
                        <div className="absolute -bottom-1 -right-1 bg-cyber-bg rounded-full p-[2px] flex items-center gap-[2px]">
                          <div className="w-1 h-[6px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-[10px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-[6px] bg-cyber-cyan animate-waveform" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>

                    {/* Chat Bubble content */}
                    <div className="space-y-1 min-w-0">
                      <div className={`
                        px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-glass border text-sm leading-relaxed font-medium
                        ${isUser 
                          ? 'bg-gradient-to-tr from-cyber-purple/25 to-cyber-purple/10 border-cyber-purple/25 text-white rounded-tr-none' 
                          : 'bg-cyber-card border-white/5 text-white/90 rounded-tl-none'}
                      `}>
                        {isUser ? (
                          msg.content
                        ) : (
                          <ReactMarkdown
                            className="prose prose-sm max-w-none"
                            components={{
                              p: ({children}) => <p className="text-white/90 text-sm leading-relaxed my-1">{children}</p>,
                              strong: ({children}) => <strong className="text-cyber-cyan font-bold">{children}</strong>,
                              em: ({children}) => <em className="text-white/70 italic">{children}</em>,
                              li: ({children}) => <li className="text-white/80 text-sm ml-4 list-disc">{children}</li>,
                              ul: ({children}) => <ul className="my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="my-1 space-y-0.5 list-decimal ml-4">{children}</ol>,
                              code: ({children, inline}) => inline
                                ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-cyber-cyan font-mono text-xs">{children}</code>
                                : <pre className="bg-white/5 border border-white/10 rounded-lg p-3 mt-2 overflow-x-auto"><code className="text-cyber-cyan font-mono text-xs">{children}</code></pre>,
                              h1: ({children}) => <h1 className="text-white font-bold text-base mb-1">{children}</h1>,
                              h2: ({children}) => <h2 className="text-white font-bold text-sm mb-1">{children}</h2>,
                              h3: ({children}) => <h3 className="text-white/80 font-semibold text-sm">{children}</h3>,
                            }}
                          >
                            {String(msg.content || '')}
                          </ReactMarkdown>
                        )}
                      </div>

                      <div className={`flex items-center gap-3 px-1 text-[10px] text-white/35 font-semibold ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <>
                            <span className="text-cyber-cyan/70 font-bold bg-cyber-cyan/5 px-1.5 py-0.5 rounded border border-cyber-cyan/10">
                              {getModelBadge(msg)}
                            </span>
                            <button
                              onClick={() => handleReplay(msg.content)}
                              className="p-1 hover:text-cyber-cyan transition-colors cursor-pointer flex items-center gap-0.5"
                              title="Listen to response"
                            >
                              <Volume2 size={12} />
                              <span>Listen</span>
                            </button>
                            <button
                              onClick={() => navigator.clipboard?.writeText(msg.content)}
                              className="p-1 hover:text-cyber-cyan transition-colors cursor-pointer flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                              title="Copy response"
                            >
                              <Copy size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Thinking / STT loading indicator */}
            {(isThinking || isSttLoading) && (
              <div className="flex justify-start animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-neonPurple flex items-center justify-center font-bold text-xs">
                    V
                  </div>
                  <div className="glass-panel border-white/5 px-5 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <span className="text-[10px] text-white/40 mr-2">
                      {isSttLoading ? 'Transcribing...' : 'Thinking...'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Floating text input bar */}
      <div className="p-3 sm:p-6 border-t border-white/5 glass-panel z-10 flex-shrink-0">
        {/* Live transcript preview while recording */}
        {isRecording && liveTranscript && (
          <div className="max-w-4xl mx-auto mb-2 sm:mb-3 px-3 sm:px-4 py-2 rounded-xl bg-cyber-cyan/5 border border-cyber-cyan/10 text-xs text-cyber-cyan/80 italic">
            "{liveTranscript}"
          </div>
        )}
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4 bg-white/5 border border-white/5 p-1.5 sm:p-2 rounded-2xl focus-within:border-cyber-cyan/20 transition-all shadow-glass relative"
        >
          {/* Mic trigger */}
          <button
            type="button"
            onClick={() => { if (isRecording) stopRecording(); else startRecording(); }}
            disabled={isSttLoading}
            className={`
              p-2.5 sm:p-3.5 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 flex-shrink-0
              ${micIsActive
                ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20' 
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}
            `}
            title={isRecording ? 'Stop & send recording' : 'Start voice input'}
          >
            {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording 
                ? 'Listening... tap mic again to send' 
                : isSttLoading 
                ? 'Transcribing audio...' 
                : 'Type your message...'
            }
            className="flex-1 bg-transparent px-1 sm:px-2 text-sm text-white/90 placeholder-white/25 focus:outline-none font-medium min-w-0"
            disabled={isRecording || isSttLoading}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="p-2.5 sm:p-3.5 bg-cyber-purple hover:bg-cyber-purple/80 disabled:opacity-40 disabled:hover:bg-cyber-purple text-white rounded-xl transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
