import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, FileText, Share2, History, Bot } from 'lucide-react';

const DocumentViewer = ({ document, onExport, onVersionHistory, onConvertToPrd, onRestoreVersion, onClosePreview }) => {
  const [showExportDropdown, setShowExportDropdown] = useState(false);

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
      
      {/* Historical Preview Banner */}
      {document.isVersionPreview && (
        <div className="bg-cyber-purple/20 border-b border-cyber-purple/40 px-4 py-2 flex items-center justify-between text-xs text-white relative z-10">
          <span className="font-semibold text-cyber-cyan flex items-center gap-1.5">
            <History size={14} />
            Viewing historical version: {document.title}
          </span>
          <div className="flex gap-2">
            {onRestoreVersion && (
              <button
                onClick={onRestoreVersion}
                className="px-2.5 py-1 bg-cyber-purple text-white font-bold rounded hover:bg-cyber-purple/90 transition-all text-[11px]"
              >
                Restore this Version
              </button>
            )}
            <button
              onClick={onClosePreview}
              className="px-2.5 py-1 bg-white/5 text-white/70 hover:text-white rounded border border-white/10 transition-all text-[11px]"
            >
              Exit Preview
            </button>
          </div>
        </div>
      )}

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
          {onConvertToPrd && (
            <button 
              onClick={onConvertToPrd}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyber-purple/20 text-cyber-purple font-bold rounded-lg border border-cyber-purple/30 hover:bg-cyber-purple/30 transition-all text-sm mr-2"
            >
              <Bot size={14} /> Convert to PRD
            </button>
          )}
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
          <div className="relative">
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all text-sm"
            >
              <Download size={14} />
              Export
            </button>
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#120e24] border border-white/10 shadow-2xl z-50 p-1">
                <button
                  onClick={() => { onExport('md'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-white/85 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
                >
                  Markdown (.md)
                </button>
                <button
                  onClick={() => { onExport('pdf'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-white/85 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
                >
                  PDF Document (.pdf)
                </button>
                <button
                  onClick={() => { onExport('docx'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-white/85 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
                >
                  Word Document (.docx)
                </button>
              </div>
            )}
          </div>
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
