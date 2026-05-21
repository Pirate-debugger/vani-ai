import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Volume2, Sparkles, User, CornerDownLeft, Trash2 } from 'lucide-react';

const Chat = ({ 
  currentLang, 
  voiceSpeed,
  voiceRecorder, 
  messages, 
  setMessages,
  onSubmitPrompt 
}) => {
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  const {
    isRecording,
    startRecording,
    stopRecording,
    speakText,
    cancelSpeech
  } = voiceRecorder;

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle Text Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText.trim();
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
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        simulated: response.simulated
      };

      setMessages(prev => [...prev, aiMsg]);
      
      // Auto speak TTS response
      speakText(response.response, currentLang, voiceSpeed);

    } catch (err) {
      console.error('Failed to get answer:', err);
    } finally {
      setIsThinking(false);
    }
  };

  // Replay speech synthesizer
  const handleReplay = (text) => {
    speakText(text, currentLang, voiceSpeed);
  };

  // Clear chat
  const handleClearChat = () => {
    cancelSpeech();
    setMessages([]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07050F] relative overflow-hidden">
      
      {/* Header Panel */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between glass-panel z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">Vani Chat Dialog</h2>
            <p className="text-[10px] text-white/40 font-medium">Conversational Memory Active</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/10 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Clear Memory</span>
          </button>
        )}
      </div>

      {/* Main Conversation Thread Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyber-cyan shadow-glow-cyan/5 animate-pulse">
              <Sparkles size={28} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">No active history</h3>
              <p className="text-xs text-white/40 max-w-xs mt-1 leading-relaxed">
                Type a prompt below or start a vocal conversation by clicking the microphone button.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-float-slow`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Icon/Avatar */}
                    <div className={`
                      w-8 h-8 min-w-8 rounded-lg flex items-center justify-center border text-xs font-bold
                      ${isUser 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan' 
                        : 'bg-cyber-purple/10 border-cyber-purple/20 text-cyber-neonPurple'}
                    `}>
                      {isUser ? <User size={14} /> : 'V'}
                    </div>

                    {/* Chat Bubble content */}
                    <div className="space-y-1">
                      <div className={`
                        px-4.5 py-3 rounded-2xl shadow-glass border text-sm leading-relaxed font-medium
                        ${isUser 
                          ? 'bg-gradient-to-tr from-cyber-purple/25 to-cyber-purple/10 border-cyber-purple/25 text-white rounded-tr-none' 
                          : 'bg-cyber-card border-white/5 text-white/90 rounded-tl-none'}
                      `}>
                        {msg.content}
                      </div>

                      {/* Info bar with timestamp, model badge, playback */}
                      <div className={`flex items-center gap-3 px-1 text-[10px] text-white/35 font-semibold ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <>
                            <span className="text-cyber-cyan/70 font-bold bg-cyber-cyan/5 px-1.5 py-0.5 rounded border border-cyber-cyan/10">
                              {msg.simulated ? 'Saaras-Bulbul' : 'Mayura:v1'}
                            </span>
                            <button
                              onClick={() => handleReplay(msg.content)}
                              className="p-1 hover:text-cyber-cyan transition-colors cursor-pointer flex items-center gap-0.5"
                              title="Listen to response"
                            >
                              <Volume2 size={12} />
                              <span>Listen</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Simulated typing state */}
            {isThinking && (
              <div className="flex justify-start animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-neonPurple flex items-center justify-center font-bold text-xs">
                    V
                  </div>
                  <div className="glass-panel border-white/5 px-5 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
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
      <div className="p-6 border-t border-white/5 glass-panel z-10">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center gap-4 bg-white/5 border border-white/5 p-2 rounded-2xl focus-within:border-cyber-cyan/20 transition-all shadow-glass relative"
        >
          {/* Quick Mic trigger */}
          <button
            type="button"
            onClick={() => {
              // Direct navigation or action triggers microphone
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            className={`
              p-3.5 rounded-xl flex items-center justify-center cursor-pointer transition-all
              ${isRecording 
                ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20' 
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}
            `}
          >
            <Mic size={16} />
          </button>

          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isRecording ? "Listening to speak..." : "Type your message and press Enter..."}
            className="flex-1 bg-transparent px-2 text-sm text-white/90 placeholder-white/25 focus:outline-none font-medium"
            disabled={isRecording}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3.5 bg-cyber-purple hover:bg-cyber-purple/80 disabled:opacity-40 disabled:hover:bg-cyber-purple text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
