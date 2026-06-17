import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, FileText, Share2, History } from 'lucide-react';

const DocumentViewer = ({ document, onExport, onVersionHistory }) => {
  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
        <FileText size={48} className="text-white/20" />
        <p>No document selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0714] border border-white/5 rounded-xl overflow-hidden shadow-2xl relative">
      <div className="cyber-bg opacity-30 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 glass-panel bg-white/5 relative z-10">
        <div>
          <h2 className="text-xl font-bold text-white">{document.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/30">
              {document.type}
            </span>
            <span className="text-xs text-white/40">
              Last updated: {new Date(document.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={onVersionHistory}
            className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
            title="Version History"
          >
            <History size={16} />
          </button>
          <button 
            className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
            title="Share"
          >
            <Share2 size={16} />
          </button>
          <button 
            onClick={() => onExport('pdf')}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all text-sm"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto prose prose-invert prose-p:text-white/80 prose-headings:text-white prose-a:text-cyber-cyan prose-strong:text-cyber-cyan/90">
          <ReactMarkdown>{document.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
