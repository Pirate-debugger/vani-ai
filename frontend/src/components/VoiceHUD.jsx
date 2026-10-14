import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Square, Send, X, Volume2, VolumeX, AlertCircle, Sparkles, Check, Edit3 } from 'lucide-react';
import VoiceOrb from './VoiceOrb';

/**
 * Focused, Context-Aware Voice HUD
 * Workflow: Listening → Transcribing → Thinking → Speaking
 * Seamless mobile-first HUD replacing or floating over composer during active voice sessions.
 */
export default function VoiceHUD({
  isRecording = false,
  isSttLoading = false,
  isStreaming = false,
  isSpeaking = false,
  voiceState = 'idle',
  transcript = '',
  liveTranscript = '',
  audioAnalyser = null,
  onStopRecording,
  onCancel,
  onSubmit,
  onInterrupt,
  onRetryMic,
  micError = null,
  onClearMicError,
  languageLabel = 'हिन्दी'
}) {
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Sync incoming transcript to editable text
  useEffect(() => {
    const activeText = (transcript || liveTranscript || '').trim();
    if (activeText && !isEditing) {
      setEditableText(activeText);
    }
  }, [transcript, liveTranscript, isEditing]);

  // Derive normalized HUD state
  const currentStage = voiceState === 'requesting_permission'
    ? 'requesting_permission'
    : isRecording
    ? 'listening'
    : isSttLoading
    ? 'transcribing'
    : isStreaming
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : voiceState === 'review'
    ? 'review'
    : voiceState === 'error'
    ? 'error'
    : 'idle';

  if (currentStage === 'idle' && !micError) {
    return null;
  }

  const handleSend = () => {
    const textToSend = editableText.trim() || transcript.trim();
    if (textToSend && onSubmit) {
      onSubmit(textToSend);
      setEditableText('');
      setIsEditing(false);
    }
  };

  return (
    <div 
      className="w-full bg-[#0d091e]/95 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 transition-all mb-2 relative z-30"
      role="region"
      aria-label="Active Voice Interaction Session"
      aria-live="polite"
    >
      {/* ── Mic Error & Recovery Banner ──────────────────────────────────── */}
      {micError && (
        <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{micError}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            {onRetryMic && (
              <button
                onClick={onRetryMic}
                className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 focus-visible:ring-2 focus-visible:ring-white transition-all shadow-sm"
              >
                Retry Permission
              </button>
            )}
            {onClearMicError && (
              <button 
                onClick={onClearMicError}
                className="p-1 hover:text-white rounded"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Top State Indicator Pipeline ──────────────────────────────────── */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar font-medium">
          {/* Requesting Permission (if active) */}
          {currentStage === 'requesting_permission' && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Requesting Mic</span>
              </div>
              <span className="text-white/20">→</span>
            </>
          )}

          {/* Listening State */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 ${
            currentStage === 'listening' 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' 
              : 'text-white/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentStage === 'listening' ? 'bg-emerald-400 animate-ping' : 'bg-white/20'}`} />
            <span>Listening</span>
          </div>

          <span className="text-white/20">→</span>

          {/* Transcribing State */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 ${
            currentStage === 'transcribing' 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' 
              : 'text-white/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentStage === 'transcribing' ? 'bg-amber-400 animate-spin' : 'bg-white/20'}`} />
            <span>Transcribing</span>
          </div>

          <span className="text-white/20">→</span>

          {/* Review / Spoken State */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 ${
            currentStage === 'review'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-white/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentStage === 'review' ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`} />
            <span>Review</span>
          </div>

          <span className="text-white/20">→</span>

          {/* Thinking State */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 ${
            currentStage === 'thinking' 
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold' 
              : 'text-white/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentStage === 'thinking' ? 'bg-indigo-400 animate-pulse' : 'bg-white/20'}`} />
            <span>Thinking</span>
          </div>

          <span className="text-white/20">→</span>

          {/* Speaking State */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 ${
            currentStage === 'speaking' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' 
              : 'text-white/40'
          }`}>
            <Volume2 size={13} className={currentStage === 'speaking' ? 'text-cyan-400 animate-bounce' : 'text-white/20'} />
            <span>Speaking</span>
          </div>
        </div>

        {/* Language Badge */}
        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/50 font-mono shrink-0">
          {languageLabel}
        </span>
      </div>

      {/* ── Visualizer & Live Transcript Area ──────────────────────────────── */}
      <div className="flex items-center gap-3 py-1">
        {/* Compact Voice Orb Canvas */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 relative flex items-center justify-center rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
          <VoiceOrb 
            voiceState={currentStage}
            analyserNode={audioAnalyser}
            size={64}
          />
        </div>

        {/* Live or Editable Transcript Container */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              className="w-full bg-white/5 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none resize-none min-h-[44px]"
              placeholder="Edit your spoken transcript..."
              rows={2}
              autoFocus
            />
          ) : (
            <div 
              onClick={() => { if (!isRecording) setIsEditing(true); }}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/5 min-h-[44px] flex items-center cursor-pointer group"
              title={isRecording ? "Listening to speech..." : "Click to edit transcript before sending"}
            >
              <p className="text-xs text-white/90 truncate leading-relaxed">
                {editableText || transcript || liveTranscript || (
                  <span className="text-white/40 italic">
                    {isRecording ? "Listening... Speak naturally in Hindi, Hinglish, or English" : "No speech detected yet"}
                  </span>
                )}
              </p>
              {!isRecording && (editableText || transcript) && (
                <Edit3 size={13} className="ml-auto text-white/30 group-hover:text-cyan-400 shrink-0 transition-colors" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Interactive Controls Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          {isSpeaking && onInterrupt && (
            <button
              onClick={onInterrupt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-all"
            >
              <VolumeX size={14} />
              <span>Interrupt Voice</span>
            </button>
          )}

          {isRecording && onStopRecording && (
            <button
              onClick={onStopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition-all"
            >
              <Square size={13} />
              <span>Stop & Transcribe</span>
            </button>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-all text-xs flex items-center gap-1"
              title="Cancel voice session"
            >
              <X size={14} />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          )}
        </div>

        {/* Send Spoken Transcript Button */}
        {!isRecording && (editableText.trim() || transcript.trim()) && (
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold text-xs shadow-md hover:opacity-95 transition-all"
          >
            <Send size={13} />
            <span>Send Spoken Prompt</span>
          </button>
        )}
      </div>
    </div>
  );
}
