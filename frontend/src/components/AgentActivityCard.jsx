import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle, 
  ExternalLink, 
  Search, 
  FileText, 
  Globe, 
  Cpu, 
  Layers, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap
} from 'lucide-react';

const AGENT_CONFIGS = {
  brd: {
    title: 'BRD Agent',
    icon: '📋',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  },
  prd: {
    title: 'PRD Agent',
    icon: '📑',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  },
  research: {
    title: 'Research Agent',
    icon: '🌐',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
  },
  startup: {
    title: 'Startup Agent',
    icon: '🚀',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  technical_architect: {
    title: 'Technical Architect',
    icon: '⚙',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  },
  task: {
    title: 'Task Agent',
    icon: '✓',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  },
  idea_discovery: {
    title: 'Idea Discovery Agent',
    icon: '💡',
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  },
  general: {
    title: 'Assistant Agent',
    icon: '✦',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  }
};

export default function AgentActivityCard({ execution, isLive = false }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (!execution) return null;

  const agentId = execution.agentId || execution.agent || 'general';
  const config = AGENT_CONFIGS[agentId] || AGENT_CONFIGS.general;
  const status = execution.status || (isLive ? 'running' : 'completed');
  const steps = execution.steps || [];
  const sources = execution.sources || execution.metadata?.sources || [];
  const providers = execution.providers || (execution.provider ? [execution.provider] : []);
  const tools = execution.toolsUsed || execution.tools || [];

  return (
    <div className="w-full my-3 rounded-xl border border-cyan-500/20 bg-[#0c0919]/90 backdrop-blur-md overflow-hidden shadow-lg shadow-cyan-950/20 text-left transition-all">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none" role="img" aria-label="agent-icon">
            {config.icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white tracking-wide">
                {execution.agentName || config.title}
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${config.badgeClass}`}>
                {agentId.toUpperCase()}
              </span>
            </div>
            {execution.plan && (
              <p className="text-xs text-white/50 line-clamp-1 mt-0.5">
                {execution.plan}
              </p>
            )}
          </div>
        </div>

        {/* Live Status & Provider Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {providers.map((p, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300/80 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md"
            >
              <Cpu size={11} className="text-cyan-400" />
              {p === 'gemini' ? 'Gemini 3.5 Flash' : p === 'openai' ? 'OpenAI GPT-4o' : p === 'sarvam' ? 'Sarvam Indic' : p}
            </span>
          ))}

          {tools.length > 0 && tools.map((t, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300/80 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded-md"
            >
              <Globe size={11} className="text-indigo-400" />
              {t.includes('tinyfish') || t.includes('web') ? 'TinyFish Live Web' : t}
            </span>
          ))}

          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            status === 'completed'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : status === 'failed'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse'
          }`}>
            {status === 'completed' && <CheckCircle2 size={12} className="text-emerald-400" />}
            {status === 'failed' && <XCircle size={12} className="text-rose-400" />}
            {status === 'running' && <Loader2 size={12} className="animate-spin text-cyan-400" />}
            {status === 'running' ? 'Active Execution' : status === 'completed' ? 'Finished' : 'Error'}
          </span>
        </div>
      </div>

      {/* Execution Steps Checklist */}
      {steps.length > 0 && (
        <div className="p-3.5 space-y-2">
          {steps.map((step, idx) => {
            const stepStatus = step.status || 'completed';
            return (
              <div 
                key={idx} 
                className={`flex items-start gap-2.5 text-xs rounded-lg px-2.5 py-1.5 transition-colors ${
                  stepStatus === 'running' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-200' 
                    : stepStatus === 'completed'
                    ? 'text-white/80 hover:bg-white/[0.02]'
                    : stepStatus === 'failed'
                    ? 'text-rose-300 bg-rose-500/10'
                    : 'text-white/40'
                }`}
              >
                <span className="mt-0.5 flex-shrink-0">
                  {stepStatus === 'completed' && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {stepStatus === 'running' && <Loader2 size={14} className="animate-spin text-cyan-400" />}
                  {stepStatus === 'failed' && <XCircle size={14} className="text-rose-400" />}
                  {stepStatus === 'pending' && <Circle size={14} className="text-white/30" />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${stepStatus === 'running' ? 'text-cyan-300' : ''}`}>
                      {step.name || step.title || step.step}
                    </span>
                    {step.durationMs && (
                      <span className="text-[10px] text-white/40 font-mono">
                        {step.durationMs}ms
                      </span>
                    )}
                  </div>
                  {step.detail && (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats (BRD/PRD metrics) */}
      {execution.stats && (
        <div className="px-4 py-2 border-t border-white/[0.05] bg-white/[0.01] flex items-center gap-3 text-xs text-white/60 flex-wrap">
          {execution.stats.requirementsCount > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <ShieldCheck size={12} />
              {execution.stats.requirementsCount} Requirements
            </span>
          )}
          {execution.stats.risksCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Zap size={12} />
              {execution.stats.risksCount} Risks
            </span>
          )}
          {execution.stats.tasksCount > 0 && (
            <span className="inline-flex items-center gap-1 text-indigo-400">
              <FileText size={12} />
              {execution.stats.tasksCount} Tasks
            </span>
          )}
          {sources.length > 0 && (
            <span className="inline-flex items-center gap-1 text-cyan-400">
              <Globe size={12} />
              {sources.length} Live Sources
            </span>
          )}
        </div>
      )}

      {/* Live Sources Accordion */}
      {sources.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="w-full px-4 py-2 text-xs flex items-center justify-between text-white/70 hover:text-white hover:bg-white/[0.02] transition-colors"
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Search size={12} className="text-cyan-400" />
              Verified Web Sources ({sources.length})
            </span>
            {sourcesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {sourcesOpen && (
            <div className="px-4 pb-3 pt-1 space-y-2 max-h-56 overflow-y-auto">
              {sources.map((src, i) => (
                <div 
                  key={i} 
                  className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white/90 truncate">
                      {src.title || src.domain || `Source #${i + 1}`}
                    </span>
                    {src.url && (
                      <a 
                        href={src.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-cyan-400 hover:text-cyan-300 flex-shrink-0 inline-flex items-center gap-0.5 text-[11px]"
                      >
                        Visit <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {src.snippet && (
                    <p className="text-[11px] text-white/50 line-clamp-2">
                      {src.snippet}
                    </p>
                  )}
                  {src.keyFinding && (
                    <p className="text-[11px] text-emerald-400/90 font-medium">
                      💡 {src.keyFinding}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
