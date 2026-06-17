import React from 'react';
import { Github, Trello, Slack, FileText } from 'lucide-react';

const IntegrationsPanel = () => {
  const integrations = [
    { id: 'github', name: 'GitHub', icon: <Github size={24} />, status: 'Coming Soon', desc: 'Sync PRDs and Tasks to GitHub Issues.' },
    { id: 'jira', name: 'Jira', icon: <div className="text-xl font-bold text-blue-500">J</div>, status: 'Coming Soon', desc: 'Export Epics and User Stories directly to Jira.' },
    { id: 'notion', name: 'Notion', icon: <div className="text-xl font-bold">N</div>, status: 'Coming Soon', desc: 'Sync BRDs, Roadmaps, and Startup Plans to Notion.' },
    { id: 'trello', name: 'Trello', icon: <Trello size={24} className="text-blue-400" />, status: 'Coming Soon', desc: 'Create Trello cards from AI-generated Roadmap phases.' },
    { id: 'google_docs', name: 'Google Docs', icon: <FileText size={24} className="text-blue-500" />, status: 'Coming Soon', desc: 'Export documents straight to your Google Drive.' },
    { id: 'slack', name: 'Slack', icon: <Slack size={24} className="text-pink-500" />, status: 'Coming Soon', desc: 'Notify your team when new plans are generated.' }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0714] border border-white/5 rounded-xl overflow-hidden shadow-2xl relative p-8">
      <div className="cyber-bg opacity-30 pointer-events-none" />
      
      <div className="relative z-10 mb-8 pb-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-cyber-cyan to-cyber-purple bg-clip-text text-transparent">
          Integrations
        </h2>
        <p className="text-sm text-white/50 mt-1">Connect Bharat Startup Copilot to your favorite execution tools.</p>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-1 md:grid-cols-2 gap-4 h-max">
        {integrations.map((intg) => (
          <div key={intg.id} className="glass-panel p-5 rounded-xl border border-white/5 hover:border-cyber-cyan/30 transition-all flex flex-col group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-cyber-cyan/50 text-white">
                {intg.icon}
              </div>
              <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/40 border border-white/10 rounded-full">
                {intg.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{intg.name}</h3>
            <p className="text-sm text-white/50 flex-1">{intg.desc}</p>
            <button className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all border border-white/10 text-sm">
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsPanel;
