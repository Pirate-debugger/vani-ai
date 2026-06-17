import React, { useState, useEffect } from 'react';
import { Github, Trello, Slack, FileText, Check, Loader2 } from 'lucide-react';

const IntegrationsPanel = () => {
  const [connections, setConnections] = useState({});
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vani_integrations') || '{}');
      setConnections(saved);
    } catch(e) {}
  }, []);

  const handleConnect = (id) => {
    if (connections[id]) {
      // Disconnect
      const updated = { ...connections };
      delete updated[id];
      setConnections(updated);
      localStorage.setItem('vani_integrations', JSON.stringify(updated));
      return;
    }

    setConnecting(id);
    // Simulate OAuth / Live Connection check
    setTimeout(() => {
      const updated = { ...connections, [id]: true };
      setConnections(updated);
      localStorage.setItem('vani_integrations', JSON.stringify(updated));
      setConnecting(null);
    }, 2000);
  };

  const integrations = [
    { id: 'github', name: 'GitHub', icon: <Github size={24} />, desc: 'Sync PRDs and Tasks to GitHub Issues.' },
    { id: 'jira', name: 'Jira', icon: <div className="text-xl font-bold text-blue-500">J</div>, desc: 'Export Epics and User Stories directly to Jira.' },
    { id: 'notion', name: 'Notion', icon: <div className="text-xl font-bold">N</div>, desc: 'Sync BRDs, Roadmaps, and Startup Plans to Notion.' },
    { id: 'trello', name: 'Trello', icon: <Trello size={24} className="text-blue-400" />, desc: 'Create Trello cards from AI-generated Roadmap phases.' },
    { id: 'google_docs', name: 'Google Docs', icon: <FileText size={24} className="text-blue-500" />, desc: 'Export documents straight to your Google Drive.' },
    { id: 'slack', name: 'Slack', icon: <Slack size={24} className="text-pink-500" />, desc: 'Notify your team when new plans are generated.' }
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
        {integrations.map((intg) => {
          const isConnected = connections[intg.id];
          const isConnecting = connecting === intg.id;

          return (
            <div key={intg.id} className={`glass-panel p-5 rounded-xl border transition-all flex flex-col group ${isConnected ? 'border-cyber-cyan/50 bg-cyber-cyan/5' : 'border-white/5 hover:border-cyber-cyan/30'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border transition-all text-white ${isConnected ? 'bg-cyber-cyan/20 border-cyber-cyan/50' : 'bg-white/5 border-white/10 group-hover:border-cyber-cyan/50'}`}>
                  {intg.icon}
                </div>
                {isConnected ? (
                  <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">
                    <Check size={10} /> Connected
                  </span>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/40 border border-white/10 rounded-full">
                    Available
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{intg.name}</h3>
              <p className="text-sm text-white/50 flex-1">{intg.desc}</p>
              
              <button 
                onClick={() => handleConnect(intg.id)}
                disabled={connecting !== null && connecting !== intg.id}
                className={`mt-4 w-full py-2 flex items-center justify-center gap-2 font-bold rounded-lg transition-all border text-sm ${
                  isConnected 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                    : isConnecting 
                      ? 'bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/30 cursor-not-allowed'
                      : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20'
                }`}
              >
                {isConnecting && <Loader2 size={16} className="animate-spin" />}
                {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPanel;
