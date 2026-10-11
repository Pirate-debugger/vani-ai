import React, { useState } from 'react';
import { 
  Repeat, 
  Play, 
  Pause, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Loader2,
  Calendar,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '../lib/api';

/**
 * ScheduledActionCard Component
 * Displays a persistent scheduled action inside conversation threads or project automations.
 * Implements: Run Now (without destroying future schedule), Pause, Resume, and Cancel.
 */
export default function ScheduledActionCard({ 
  action, 
  onActionUpdated, 
  onActionDeleted,
  compact = false 
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  if (!action) return null;

  const {
    id,
    title,
    actionType = 'research',
    schedule = 'Once',
    timezone = 'Asia/Kolkata',
    status = 'scheduled',
    nextRunAt,
    lastRunAt,
    lastResult
  } = action;

  // Format next run time
  const formattedNextRun = nextRunAt 
    ? new Date(nextRunAt).toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) 
    : null;

  // Short timezone abbreviation
  const tzShort = timezone.includes('Kolkata') ? 'IST' : timezone.split('/')[1] || timezone;

  // Handle Run Now
  const handleRunNow = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      const res = await apiClient.post(`/schedule/${id}/run-now`);
      if (res.data?.success) {
        setSuccessNotice('Ran successfully! Future schedule preserved.');
        if (onActionUpdated && res.data?.result) {
          onActionUpdated({ ...action, lastRunAt: new Date().toISOString(), status: 'scheduled' });
        }
      }
    } catch (err) {
      console.error('[Run Now Error]:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Run failed');
    } finally {
      setIsRunning(false);
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  // Handle Pause
  const handlePause = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/schedule/${id}/pause`);
      if (res.data?.action && onActionUpdated) {
        onActionUpdated(res.data.action);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Resume
  const handleResume = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/schedule/${id}/resume`);
      if (res.data?.action && onActionUpdated) {
        onActionUpdated(res.data.action);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Cancel
  const handleCancel = async () => {
    if (!window.confirm(`Are you sure you want to cancel "${title}"?`)) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await apiClient.delete(`/schedule/${id}`);
      if (onActionDeleted) {
        onActionDeleted(id);
      } else if (onActionUpdated) {
        onActionUpdated({ ...action, status: 'cancelled' });
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Status badge styling
  const statusConfig = {
    scheduled: { label: 'Scheduled', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    running: { label: 'Running', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse' },
    completed: { label: 'Completed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    paused: { label: 'Paused', bg: 'bg-white/10 text-white/50 border-white/10' },
    cancelled: { label: 'Cancelled', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    failed: { label: 'Failed', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' }
  }[status] || { label: status, bg: 'bg-white/10 text-white/60 border-white/10' };

  return (
    <div className={`my-2 rounded-2xl border transition-all ${
      status === 'paused' || status === 'cancelled'
        ? 'bg-white/[0.02] border-white/5 opacity-75'
        : 'bg-[#0E0C1B] border-cyan-500/20 hover:border-cyan-500/40 shadow-lg'
    } p-3 sm:p-4 text-xs`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Repeat size={13} className={status === 'running' || isRunning ? 'animate-spin' : ''} />
          </div>
          <div>
            <span className="font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>↻ Scheduled</span>
              <span className="text-white/30">•</span>
              <span className="text-white/60 font-normal">{schedule}</span>
              {tzShort && (
                <span className="px-1.5 py-0.2 rounded bg-white/5 text-[10px] text-white/40 uppercase font-mono">
                  {tzShort}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusConfig.bg}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Title & Description */}
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-white/95 leading-snug">
          {title}
        </h4>
        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-white/50">
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-cyan-400" />
            <span className="capitalize">{actionType}</span>
          </span>
          {formattedNextRun && status !== 'paused' && status !== 'cancelled' && (
            <span className="flex items-center gap-1 text-white/70">
              <Clock size={11} className="text-white/40" />
              <span>Next: {formattedNextRun}</span>
            </span>
          )}
          {lastRunAt && (
            <span className="text-white/40">
              Last run: {new Date(lastRunAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="mb-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
          <AlertCircle size={13} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Last Result Accordion (if available) */}
      {lastResult && (
        <div className="mb-3 border border-white/5 rounded-xl bg-white/[0.02] overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] text-white/60 hover:text-white"
          >
            <span>Previous execution output</span>
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          {expanded && (
            <div className="p-3 border-t border-white/5 text-[11px] text-white/80 max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-mono">
              {typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
        <div className="flex items-center gap-1.5">
          {status !== 'cancelled' && (
            <button
              onClick={handleRunNow}
              disabled={isRunning || isUpdating}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              title="Execute immediately without modifying future recurrence"
            >
              {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
              <span>{isRunning ? 'Running...' : 'Run now'}</span>
            </button>
          )}

          {status === 'scheduled' && (
            <button
              onClick={handlePause}
              disabled={isUpdating || isRunning}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/10 transition-colors flex items-center gap-1 text-xs"
              title="Pause recurrence"
            >
              <Pause size={12} />
              <span>Pause</span>
            </button>
          )}

          {status === 'paused' && (
            <button
              onClick={handleResume}
              disabled={isUpdating || isRunning}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Resume schedule"
            >
              <Play size={12} fill="currentColor" />
              <span>Resume</span>
            </button>
          )}
        </div>

        {status !== 'cancelled' && (
          <button
            onClick={handleCancel}
            disabled={isUpdating || isRunning}
            className="p-1.5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Cancel scheduled action"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
