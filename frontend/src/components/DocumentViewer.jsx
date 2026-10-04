import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Download, 
  FileText, 
  Share2, 
  History, 
  Bot, 
  Globe, 
  ShieldCheck, 
  ExternalLink,
  Layers,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Target,
  ListFilter
} from 'lucide-react';

export default function DocumentViewer({ 
  document, 
  projectTasks = [], 
  versions: propVersions = [],
  onExport, 
  onVersionHistory, 
  onConvertToPrd, 
  onRestoreVersion, 
  onClosePreview 
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'requirements' | 'research' | 'tasks' | 'document' | 'versions'
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [fetchedVersions, setFetchedVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [restoringId, setRestoringId] = useState(null);


  // Extract structured sections from markdown content
  const parsedSections = useMemo(() => {
    if (!document?.content || typeof document.content !== 'string') {
      return {
        summary: document?.summary || '',
        frs: [],
        nfrs: [],
        risks: [],
        kpis: [],
        competitors: ''
      };
    }

    const content = document.content;

    // Helper to extract text between headings
    const extractSection = (headingRegex) => {
      const match = content.match(headingRegex);
      if (!match) return '';
      const startIdx = match.index + match[0].length;
      const nextHeading = content.slice(startIdx).search(/\n##\s+/);
      return nextHeading !== -1 
        ? content.slice(startIdx, startIdx + nextHeading).trim() 
        : content.slice(startIdx).trim();
    };

    // Extract Summary / Objectives
    const execSummary = extractSection(/##\s+(?:1\.\s*)?Executive\s+Summary/i) || document.summary || '';
    const objectives = extractSection(/##\s+(?:4\.\s*)?Business\s+Objectives/i);
    const goals = extractSection(/##\s+(?:5\.\s*)?Goals/i);
    const kpisText = extractSection(/##\s+(?:22\.\s*)?KPIs/i);
    const risksText = extractSection(/##\s+(?:21\.\s*)?Risks\s*(?:&|and)?\s*Mitigation/i);
    const competitorText = extractSection(/##\s+(?:23\.\s*)?Competitor\s+Analysis/i);

    // Extract Functional Requirements
    const frSection = extractSection(/##\s+(?:12\.\s*)?Functional\s+Requirements/i);
    const frMatches = [...frSection.matchAll(/-\s*\*\*(FR-\d+)\*\*:\s*([^\n]+)([\s\S]*?)(?=(?:-\s*\*\*FR-\d+\*\*|\n##|$))/g)];
    const frs = frMatches.map(m => {
      const id = m[1];
      const title = m[2].trim();
      const body = m[3] || '';
      const actorMatch = body.match(/Actor\*\*:\s*([^\n]+)/i);
      const priorityMatch = body.match(/Priority\*\*:\s*([^\n]+)/i);
      const outcomeMatch = body.match(/Expected Outcome\*\*:\s*([^\n]+)/i);
      const descMatch = body.match(/Description\*\*:\s*([^\n]+)/i);

      return {
        id,
        title,
        description: descMatch ? descMatch[1].trim() : body.trim(),
        actor: actorMatch ? actorMatch[1].trim() : 'User',
        priority: priorityMatch ? priorityMatch[1].trim() : 'High',
        expectedOutcome: outcomeMatch ? outcomeMatch[1].trim() : ''
      };
    });

    // Extract Non-Functional Requirements
    const nfrSection = extractSection(/##\s+(?:13\.\s*)?Non-Functional\s+Requirements/i);
    const nfrMatches = [...nfrSection.matchAll(/-\s*\*\*(NFR-\d+)\*\*:\s*\[?([^\]\n]+)\]?/g)];
    const nfrs = nfrMatches.map(m => ({
      id: m[1],
      title: m[2].trim()
    }));

    // Extract Risks
    const riskLines = risksText
      ? risksText.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*')).map(l => l.replace(/^[-*]\s*/, '').trim())
      : [];

    // Extract KPIs
    const kpiLines = kpisText
      ? kpisText.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*')).map(l => l.replace(/^[-*]\s*/, '').trim())
      : [];

    return {
      summary: execSummary,
      objectives,
      goals,
      frs,
      nfrs,
      risks: riskLines,
      kpis: kpiLines,
      competitors: competitorText
    };
  }, [document?.content, document?.summary]);

  const versionsList = useMemo(() => {
    if (propVersions && propVersions.length > 0) return propVersions;
    if (document?.versions && document.versions.length > 0) return document.versions;
    return fetchedVersions;
  }, [propVersions, document?.versions, fetchedVersions]);

  React.useEffect(() => {
    if (activeTab === 'versions' && document?.id && versionsList.length === 0) {
      setVersionsLoading(true);
      fetch(`/api/document/${document.id}/versions`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setFetchedVersions(data);
        })
        .catch(err => console.error('Failed to load document versions', err))
        .finally(() => setVersionsLoading(false));
    }
  }, [activeTab, document?.id, versionsList.length]);

  const handleRestore = async (version) => {
    if (!version || !document?.id) return;
    setRestoringId(version.id);
    try {
      if (onRestoreVersion) {
        await onRestoreVersion(version);
      } else {
        await fetch(`/api/document/${document.id}/restore/${version.id}`, {
          method: 'POST',
          credentials: 'include'
        });
        window.dispatchEvent(new Event('vani_document_created'));
      }
      setPreviewVersion(null);
    } catch (err) {
      console.error('Failed to restore version', err);
    } finally {
      setRestoringId(null);
    }
  };

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
        <FileText size={48} className="text-white/20" />
        <p>No document selected</p>
      </div>
    );
  }

  // Detect whether research sources were used in this document
  const sources = document.metadata?.sources || [];
  const hasLiveResearch = sources.length > 0 || Boolean(
    document.metadata?.researchUsed ||
    (typeof document.content === 'string' && (
      document.content.includes('VERIFIED LIVE WEB RESEARCH') ||
      document.content.includes('TinyFish')
    ))
  );

  const tasks = document.tasks || projectTasks || [];

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
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{document.title}</h2>
            {hasLiveResearch && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
                <Globe size={11} className="animate-spin" /> Live Research Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/30">
              {document.type || 'BRD'}
            </span>
            <span className="text-xs text-white/40">
              Last updated: {new Date(document.updatedAt || Date.now()).toLocaleString()}
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
                  onClick={() => { onExport('json'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-white/85 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
                >
                  Structured JSON (.json)
                </button>
                <button
                  onClick={() => { onExport('txt'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-white/85 hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-md transition-colors"
                >
                  Plain Text (.txt)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar (Overview, Requirements, Research, Tasks, Document, Versions) */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-black/40 text-xs z-10 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Target size={14} /> Overview
        </button>

        <button
          onClick={() => setActiveTab('requirements')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'requirements'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers size={14} /> Requirements {parsedSections.frs.length > 0 && `(${parsedSections.frs.length})`}
        </button>

        <button
          onClick={() => setActiveTab('research')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'research'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe size={14} /> Research {sources.length > 0 && `(${sources.length})`}
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'tasks'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <CheckSquare size={14} /> Tasks {tasks.length > 0 && `(${tasks.length})`}
        </button>

        <button
          onClick={() => setActiveTab('document')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'document'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText size={14} /> Document
        </button>

        <button
          onClick={() => { setActiveTab('versions'); onVersionHistory?.(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'versions'
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <History size={14} /> Versions
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10 shadow-lg">
                <h3 className="text-sm font-bold text-cyber-cyan uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Target size={16} /> Executive Summary
                </h3>
                <div className="prose prose-invert text-white/80 text-sm leading-relaxed">
                  <ReactMarkdown>{parsedSections.summary || 'Summary not explicitly provided.'}</ReactMarkdown>
                </div>
              </div>

              {/* Goals & KPIs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-emerald-500/20">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={14} /> Measurable KPIs & Targets
                  </h4>
                  {parsedSections.kpis.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-white/70">
                      {parsedSections.kpis.map((kpi, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{kpi}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-white/40 italic">Review Section 22 in full document for detailed metrics.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-amber-500/20">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Key Risks & Mitigation
                  </h4>
                  {parsedSections.risks.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-white/70">
                      {parsedSections.risks.slice(0, 5).map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5">⚠</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-white/40 italic">Review Section 21 in full document for complete risk matrix.</p>
                  )}
                </div>
              </div>

              {/* Competitor Overview snippet if available */}
              {parsedSections.competitors && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-cyan-500/20">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Globe size={14} /> Competitor & Market Analysis
                  </h4>
                  <div className="text-xs text-white/80 line-clamp-4">
                    <ReactMarkdown>{parsedSections.competitors}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-cyber-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} /> Functional Requirements ({parsedSections.frs.length})
                </h3>
                {parsedSections.frs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {parsedSections.frs.map((fr, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-cyber-cyan/40 transition-all flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30">
                              {fr.id}
                            </span>
                            <span className="font-semibold text-sm text-white">{fr.title}</span>
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            fr.priority.toLowerCase().includes('high')
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {fr.priority}
                          </span>
                        </div>

                        {fr.description && (
                          <p className="text-xs text-white/70">{fr.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-white/40 pt-1 border-t border-white/[0.04]">
                          <span>Actor: <strong className="text-white/70">{fr.actor}</strong></span>
                          {fr.expectedOutcome && (
                            <span>Outcome: <strong className="text-white/70">{fr.expectedOutcome}</strong></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/50 italic">See full document tab for raw functional requirement text.</p>
                )}
              </div>

              {/* NFRs */}
              {parsedSections.nfrs.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-cyber-purple uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={16} /> Non-Functional Requirements ({parsedSections.nfrs.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {parsedSections.nfrs.map((nfr, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs flex items-center gap-2">
                        <span className="font-mono text-cyber-purple font-bold">{nfr.id}</span>
                        <span className="text-white/80">{nfr.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESEARCH SOURCES */}
          {activeTab === 'research' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-cyber-cyan font-bold text-xs uppercase tracking-wider">
                  <Globe size={14} className="text-cyber-cyan" /> Grounded Web Research Sources (TinyFish)
                </span>
                <span className="text-xs text-white/40">{sources.length} Verified Sources</span>
              </div>

              {sources.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-cyber-cyan/40 hover:bg-black/60 transition-all flex flex-col justify-between group shadow-md"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-cyber-cyan flex items-center justify-between">
                          <span className="truncate mr-2">{src.title || 'Web Citation'}</span>
                          <ExternalLink size={12} className="opacity-60 group-hover:opacity-100 shrink-0" />
                        </div>
                        <div className="text-[11px] text-white/50 truncate mt-0.5">{src.domain || src.url}</div>
                        {src.key_findings && src.key_findings.length > 0 ? (
                          <p className="text-[11px] text-emerald-400/90 line-clamp-3 mt-2 font-medium">💡 {src.key_findings[0]}</p>
                        ) : (
                          src.snippet && <p className="text-[11px] text-white/70 line-clamp-3 mt-2">{src.snippet}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/40 rounded-xl bg-white/[0.01] border border-white/5">
                  <Globe size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No web citations attached to this document. Real-time web research runs when asking Vani for competitor or market analysis.</p>
                </div>
              )}

              {/* Structured Evidence from Live Research */}
              {document.metadata?.evidence && Array.isArray(document.metadata.evidence) && document.metadata.evidence.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-cyber-cyan" /> Grounded Evidence & Claims
                  </h4>
                  <div className="space-y-2.5">
                    {document.metadata.evidence.map((ev, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-white/95">{ev.claim}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            {ev.confidence || 'high'} confidence
                          </span>
                        </div>
                        <p className="text-white/60 mt-1.5 leading-relaxed">{ev.evidence}</p>
                        {ev.source && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                            <span className="truncate">Source: {ev.source}</span>
                            {ev.url && (
                              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline flex items-center gap-1 shrink-0">
                                View link <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <CheckSquare size={14} className="text-indigo-400" /> Implementation Tasks ({tasks.length})
                </span>
                <span className="text-xs text-white/40">Extracted from BRD</span>
              </div>

              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {tasks.map((task, idx) => (
                    <div 
                      key={task.id || idx}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">{task.title}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            (task.priority || 'medium').toLowerCase() === 'high'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {task.priority || 'medium'}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-white/60 mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>

                      <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium shrink-0 ${
                        task.status === 'completed' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-white/5 text-white/60'
                      }`}>
                        {task.status || 'todo'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-white/40 rounded-xl bg-white/[0.01] border border-white/5">
                  <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No tasks currently extracted. Vani automatically creates tasks when generating or updating documents.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COMPLETE MARKDOWN DOCUMENT */}
          {activeTab === 'document' && (
            <div className="prose prose-invert prose-p:text-white/80 prose-headings:text-white prose-a:text-cyber-cyan prose-strong:text-cyber-cyan/90 max-w-none">
              <ReactMarkdown>{document.content}</ReactMarkdown>
            </div>
          )}

          {/* TAB 6: VERSIONS */}
          {activeTab === 'versions' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History size={16} className="text-cyber-cyan" /> Version History & Snapshots
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Review previous versions, inspect changes, and restore any historical snapshot.
                  </p>
                </div>
                <span className="text-xs text-cyber-cyan font-mono bg-cyber-cyan/10 px-2.5 py-1 rounded-md border border-cyber-cyan/20">
                  {versionsList.length} {versionsList.length === 1 ? 'version' : 'versions'}
                </span>
              </div>

              {versionsLoading ? (
                <div className="p-8 text-center text-white/40 animate-pulse text-xs">
                  Loading version snapshots...
                </div>
              ) : versionsList.length === 0 ? (
                <div className="p-8 text-center text-white/40 rounded-xl bg-white/[0.01] border border-white/5">
                  <History size={32} className="mx-auto mb-2 opacity-30 text-cyber-cyan" />
                  <p className="text-xs">No historical versions recorded yet. Updates and regenerations create version snapshots automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Version List */}
                  <div className="lg:col-span-1 space-y-2">
                    {versionsList.map((ver, idx) => (
                      <div
                        key={ver.id || idx}
                        onClick={() => setPreviewVersion(ver)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          previewVersion?.id === ver.id
                            ? 'bg-cyber-cyan/15 border-cyber-cyan/40 text-white shadow-lg'
                            : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-cyber-cyan">
                            {ver.versionName || `Version ${versionsList.length - idx}`}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono">
                            {ver.createdAt ? new Date(ver.createdAt).toLocaleDateString() : 'Initial'}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 line-clamp-2">
                          {ver.content ? ver.content.slice(0, 100) : 'Snapshot data'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Version Detail & Restore View */}
                  <div className="lg:col-span-2 p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between min-h-[280px]">
                    {previewVersion ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div>
                            <span className="font-bold text-sm text-white">{previewVersion.versionName}</span>
                            <p className="text-[11px] text-white/40">Created {new Date(previewVersion.createdAt).toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => handleRestore(previewVersion)}
                            disabled={restoringId === previewVersion.id}
                            className="px-3 py-1.5 bg-cyber-purple hover:bg-cyber-purple/90 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <History size={13} />
                            {restoringId === previewVersion.id ? 'Restoring...' : 'Restore This Version'}
                          </button>
                        </div>
                        <div className="max-h-72 overflow-y-auto text-xs text-white/70 leading-relaxed font-mono bg-black/40 p-3 rounded-lg border border-white/5 custom-scrollbar whitespace-pre-wrap">
                          {previewVersion.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-white/40">
                        <History size={28} className="mb-2 opacity-30 text-cyber-cyan" />
                        <p className="text-xs">Select any version from the left to inspect its content or restore it as the active document.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
