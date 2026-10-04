import React, { useState, useEffect } from 'react';
import { Globe, Mic, Cpu, Sparkles, Github, Trello, Slack, FileText, Check, AlertCircle, Clock, RefreshCw } from 'lucide-react';

const IntegrationsPanel = () => {
  const [statuses, setStatuses] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integrations/status', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (err) {
      console.error('Failed to load integration statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30 rounded-full">
            <Check size={11} /> Connected
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
            <AlertCircle size={11} /> Not Configured
          </span>
        );
      case 'COMING_SOON':
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-white/5 text-white/40 border border-white/10 rounded-full">
            <Clock size={11} /> Coming Soon
          </span>
        );
    }
  };

  const integrations = [
    {
      id: 'tinyfish',
      name: 'TinyFish Web Agent',
      icon: <Globe size={24} className="text-cyber-cyan" />,
      desc: 'Live autonomous web search, website scraping, and competitive market intelligence.',
      status: statuses?.tinyfish?.status || 'NOT_CONFIGURED',
      capabilities: statuses?.tinyfish?.capabilities || ['search', 'fetch', 'web-agent'],
      envVar: 'TINYFISH_API_KEY'
    },
    {
      id: 'sarvam',
      name: 'Sarvam AI Voice Platform',
      icon: <Mic size={24} className="text-cyber-purple" />,
      desc: 'Indic voice synthesis (Bulbul v2), speech-to-text (Saaras v3), and Indian language translation.',
      status: statuses?.sarvam?.status || 'NOT_CONFIGURED',
      capabilities: statuses?.sarvam?.capabilities || ['stt', 'tts', 'translate'],
      envVar: 'SARVAM_API_KEY'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      icon: <Sparkles size={24} className="text-cyber-cyan" />,
      desc: 'High-speed reasoning, 27-section BRD generation, and structured task extraction.',
      status: statuses?.gemini?.status || 'NOT_CONFIGURED',
      capabilities: statuses?.gemini?.capabilities || ['reasoning', 'document-generation'],
      envVar: 'GEMINI_API_KEY'
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      icon: <Cpu size={24} className="text-green-400" />,
      desc: 'Secondary reasoning engine and structured document synthesis fallback.',
      status: statuses?.openai?.status || 'NOT_CONFIGURED',
      capabilities: statuses?.openai?.capabilities || ['chat', 'reasoning'],
      envVar: 'OPENAI_API_KEY'
    },
    {
      id: 'github',
      name: 'GitHub Issues',
      icon: <Github size={24} className="text-white/80" />,
      desc: 'Sync extracted project action items directly to GitHub repositories as issues.',
      status: 'COMING_SOON',
      capabilities: ['task-sync']
    },
    {
      id: 'notion',
      name: 'Notion Workspace',
      icon: <div className="text-xl font-bold text-white/80">N</div>,
      desc: 'Export structured BRDs, PRDs, and roadmaps directly into Notion pages.',
      status: 'COMING_SOON',
      capabilities: ['doc-export']
    },
    {
      id: 'trello',
      name: 'Trello Board',
      icon: <Trello size={24} className="text-blue-400" />,
      desc: 'Convert extracted delivery tasks into Kanban cards in designated lists.',
      status: 'COMING_SOON',
      capabilities: ['task-sync']
    },
    {
      id: 'slack',
      name: 'Slack Alerts',
      icon: <Slack size={24} className="text-pink-400" />,
      desc: 'Broadcast updates to engineering channels when requirements are ready.',
      status: 'COMING_SOON',
      capabilities: ['notifications']
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0714] border border-white/5 rounded-xl overflow-hidden shadow-2xl relative p-6 sm:p-8">
      <div className="cyber-bg opacity-30 pointer-events-none" />
      
      <div className="relative z-10 mb-6 pb-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-cyber-cyan to-cyber-purple bg-clip-text text-transparent">
            Integrations & AI Services
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Real-time status of backend AI providers, web agents, and external connectors.
          </p>
        </div>
        <button
          onClick={fetchStatuses}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg border border-white/10 text-xs font-semibold transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((intg) => {
          const isConnected = intg.status === 'CONNECTED';
          const isNotConfigured = intg.status === 'NOT_CONFIGURED';

          return (
            <div 
              key={intg.id} 
              className={`glass-panel p-5 rounded-xl border transition-all flex flex-col justify-between ${
                isConnected 
                  ? 'border-cyber-cyan/40 bg-cyber-cyan/[0.04]' 
                  : isNotConfigured
                    ? 'border-amber-500/20 bg-amber-500/[0.02]'
                    : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border transition-all ${
                    isConnected ? 'bg-cyber-cyan/15 border-cyber-cyan/40' : 'bg-white/5 border-white/10'
                  }`}>
                    {intg.icon}
                  </div>
                  {getStatusBadge(intg.status)}
                </div>

                <h3 className="text-base font-bold text-white mb-1">{intg.name}</h3>
                <p className="text-xs text-white/55 leading-relaxed mb-3">{intg.desc}</p>
              </div>

              <div>
                {intg.capabilities && intg.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                    {intg.capabilities.map((cap, i) => (
                      <span key={i} className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/5">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
                {intg.envVar && isNotConfigured && (
                  <p className="text-[10px] text-amber-400/80 mt-2 font-mono">
                    Configure {intg.envVar} in backend/.env to activate
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPanel;
