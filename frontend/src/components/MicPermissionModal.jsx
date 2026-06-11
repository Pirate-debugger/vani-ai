import React from 'react';
import { Mic, CheckCircle2, Shield } from 'lucide-react';

const MicPermissionModal = ({ onAllow, onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel max-w-sm w-full p-6 rounded-3xl border border-cyber-cyan/20 shadow-glow-cyan/10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyber-purple to-cyber-cyan" />
        
        <div className="w-16 h-16 mx-auto bg-cyber-cyan/10 rounded-2xl flex items-center justify-center mb-4 text-cyber-cyan shadow-glow-cyan/5">
          <Mic size={32} />
        </div>
        
        <h2 className="text-xl font-extrabold text-white mb-2">Vani AI needs your microphone</h2>
        
        <div className="space-y-3 text-sm text-white/70 text-left bg-white/5 p-4 rounded-xl mb-6">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-cyber-cyan shrink-0 mt-0.5" />
            <p>Speak naturally in your preferred language</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-cyber-cyan shrink-0 mt-0.5" />
            <p>Experience real-time voice translation</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={16} className="text-cyber-cyan shrink-0 mt-0.5" />
            <p>Audio is securely processed and not stored</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={onAllow}
            className="w-full py-3 bg-gradient-to-r from-cyber-purple to-cyber-cyan rounded-xl text-white font-bold tracking-wide hover:opacity-90 transition-opacity"
          >
            Allow Microphone
          </button>
          <button 
            onClick={onDismiss}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white font-semibold transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

export default MicPermissionModal;
