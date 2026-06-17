import React from 'react';
import { Calendar, CheckCircle, Circle, ArrowRight } from 'lucide-react';

const RoadmapTimeline = ({ document }) => {
  if (!document || document.type !== 'roadmap') {
    return <div className="text-white/50 p-8">Select a roadmap document to view timeline.</div>;
  }

  // A real implementation would parse the Markdown content to extract phases.
  // For demo, we'll mock the phases based on typical LLM output for the roadmap agent.
  const mockPhases = [
    { title: 'Phase 1: MVP', status: 'active', timeline: 'Weeks 1-4', details: 'Core platform build, Database setup, Basic Voice features' },
    { title: 'Phase 2: Beta', status: 'pending', timeline: 'Weeks 5-8', details: 'Agent integrations, Document export, User testing' },
    { title: 'Phase 3: Launch', status: 'pending', timeline: 'Weeks 9-10', details: 'Marketing campaign, Scale infrastructure, Go-to-market' },
    { title: 'Phase 4: Scale', status: 'pending', timeline: 'Weeks 11+', details: 'Advanced analytics, Enterprise tier, Real-time collaboration' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0714] border border-white/5 rounded-xl overflow-hidden shadow-2xl p-8 relative">
      <div className="cyber-bg opacity-30 pointer-events-none" />
      
      <div className="relative z-10 mb-8 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-cyber-cyan to-cyber-purple bg-clip-text text-transparent">
            Product Roadmap
          </h2>
          <p className="text-sm text-white/50 mt-1">{document.title}</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all border border-white/10">
          <Calendar size={14} />
          Sync to Calendar
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-4">
        <div className="space-y-8">
          {mockPhases.map((phase, idx) => (
            <div key={idx} className="flex gap-4 group">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-glow-neon flex-shrink-0 z-10 ${
                  phase.status === 'active' 
                    ? 'bg-cyber-cyan/20 border-2 border-cyber-cyan text-cyber-cyan' 
                    : 'bg-[#110e20] border-2 border-white/20 text-white/30 group-hover:border-white/40'
                }`}>
                  {phase.status === 'active' ? <CheckCircle size={16} /> : <Circle size={16} />}
                </div>
                {idx !== mockPhases.length - 1 && (
                  <div className={`w-0.5 h-full my-2 rounded-full ${
                    phase.status === 'active' ? 'bg-gradient-to-b from-cyber-cyan to-white/10' : 'bg-white/10 group-hover:bg-white/20'
                  }`} />
                )}
              </div>
              <div className={`glass-panel p-5 rounded-xl border flex-1 transition-all ${
                phase.status === 'active' ? 'border-cyber-cyan/30 bg-cyber-cyan/5' : 'border-white/5 hover:border-white/20 hover:bg-white/5'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-lg font-bold ${phase.status === 'active' ? 'text-cyber-cyan' : 'text-white'}`}>
                    {phase.title}
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-white/60">
                    {phase.timeline}
                  </span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  {phase.details}
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center text-xs font-bold text-cyber-cyan/70 hover:text-cyber-cyan cursor-pointer w-fit gap-1">
                  View Tasks <ArrowRight size={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoadmapTimeline;
