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
  ListFilter,
  Users,
  Workflow,
  Sparkles,
  HelpCircle,
  Edit3,
  Copy,
  Check,
  Search,
  ArrowRight,
  Flame,
  Code2,
  DollarSign
} from 'lucide-react';

export default function DocumentViewer({ 
  document, 
  projectTasks = [], 
  versions: propVersions = [],
  onExport, 
  onVersionHistory, 
  onConvertToPrd, 
  onRestoreVersion, 
  onClosePreview,
  onAskVani,
  onFollowUpAction,
  onEditDocument
}) {
  // 11 Canonical Tabs as defined in Product Spec
  const [activeTab, setActiveTab] = useState('overview'); 
  // 'overview' | 'requirements' | 'research' | 'competitors' | 'personas' | 'workflows' | 'risks' | 'kpis' | 'tasks' | 'document' | 'versions'
  
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [fetchedVersions, setFetchedVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [researchFilter, setResearchFilter] = useState('all'); // 'all' | 'high' | 'needs_verification'

  // Extract structured sections from markdown content
  const parsedSections = useMemo(() => {
    if (!document?.content || typeof document.content !== 'string') {
      return {
        summary: document?.summary || '',
        frs: [],
        nfrs: [],
        risks: [],
        kpis: [],
        competitors: '',
        personas: '',
        workflows: '',
        rules: ''
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

    // Extract sections
    const execSummary = extractSection(/##\s+(?:1\.\s*)?Executive\s+Summary/i) || document.summary || '';
    const objectives = extractSection(/##\s+(?:4\.\s*)?Business\s+Objectives/i);
    const goals = extractSection(/##\s+(?:5\.\s*)?Goals/i);
    const personasText = extractSection(/##\s+(?:9\.\s*)?Personas/i) || extractSection(/##\s+(?:8\.\s*)?Target\s+Users/i);
    const workflowsText = extractSection(/##\s+(?:15\.\s*)?User\s+Workflows/i);
    const rulesText = extractSection(/##\s+(?:14\.\s*)?Business\s+Rules/i);
    const kpisText = extractSection(/##\s+(?:22\.\s*)?KPIs/i) || extractSection(/##\s+(?:6\.\s*)?Success\s+Criteria/i);
    const risksText = extractSection(/##\s+(?:21\.\s*)?Risks\s*(?:&|and)?\s*Mitigation/i);
    const competitorText = extractSection(/##\s+(?:23\.\s*)?Competitor\s+Analysis/i) || extractSection(/##\s+(?:24\.\s*)?Market\s+Insights/i);

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
      personas: personasText,
      workflows: workflowsText,
      rules: rulesText,
      frs,
      nfrs,
      risks: riskLines,
      kpis: kpiLines,
      competitors: competitorText
    };
  }, [document?.content, document?.summary]);

  // Safe parsing of metadata
  const docMetadata = useMemo(() => {
    if (!document?.metadata) return {};
    if (typeof document.metadata === 'object') return document.metadata;
    try {
      return JSON.parse(document.metadata);
    } catch {
      return {};
    }
  }, [document?.metadata]);

  const sources = docMetadata?.sources || [];
  const evidenceList = docMetadata?.evidence || [];
  const hasLiveResearch = sources.length > 0 || docMetadata?.researchUsed;
  const tasks = (document?.tasks && document.tasks.length > 0) ? document.tasks : (projectTasks || []);

  const highConfidenceCount = evidenceList.filter(e => (e.confidence || '').toLowerCase() === 'high').length;
  const needsVerificationCount = evidenceList.filter(e => (e.confidence || '').toLowerCase().includes('verification')).length;

  const versionsList = useMemo(() => {
    if (propVersions && propVersions.length > 0) return propVersions;
    if (document?.versions && document.versions.length > 0) return document.versions;
    return fetchedVersions;
  }, [propVersions, document?.versions, fetchedVersions]);

  // Version Fetching
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
        window.dispatchEvent(new CustomEvent('vani_document_created', { detail: { documentId: document.id } }));
      }
      setPreviewVersion(null);
    } catch (err) {
      console.error('Failed to restore version', err);
    } finally {
      setRestoringId(null);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(document.content || '');
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
        <FileText size={48} className="text-white/20 animate-pulse" />
        <p className="text-sm">No document selected in workspace</p>
      </div>
    );
  }

  const allRequirementsCount = parsedSections.frs.length + parsedSections.nfrs.length;

  return (
    <div className="flex flex-col h-full bg-[#07050F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="cyber-bg opacity-20 pointer-events-none" />
      
      {/* Historical Version Preview Banner */}
      {document.isVersionPreview && (
        <div className="bg-cyber-purple/20 border-b border-cyber-purple/40 px-4 py-2.5 flex items-center justify-between text-xs text-white relative z-10 backdrop-blur-md">
          <span className="font-semibold text-cyber-cyan flex items-center gap-1.5">
            <History size={14} /> Viewing historical version: {document.title}
          </span>
          <div className="flex gap-2">
            {onRestoreVersion && (
              <button
                onClick={onRestoreVersion}
                className="px-3 py-1 bg-cyber-purple text-white font-bold rounded-lg hover:bg-cyber-purple/90 transition-all text-xs shadow-md"
              >
                Restore Version
              </button>
            )}
            <button
              onClick={onClosePreview}
              className="px-3 py-1 bg-white/5 text-white/70 hover:text-white rounded-lg border border-white/10 transition-all text-xs"
            >
              Exit Preview
            </button>
          </div>
        </div>
      )}

      {/* ── Top Header (Section 13) ────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] backdrop-blur-md relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{document.title}</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ready
            </span>
            {hasLiveResearch && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
                <Globe size={11} /> Live Research Verified
              </span>
            )}
          </div>

          {/* Metric Counters */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Globe size={13} className="text-cyber-cyan" />
              <span>Research: <strong className="text-white">{sources.length}</strong> sources</span>
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} className="text-cyber-purple" />
              <span>Requirements: <strong className="text-white">{allRequirementsCount}</strong></span>
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <CheckSquare size={13} className="text-emerald-400" />
              <span>Tasks: <strong className="text-white">{tasks.length}</strong></span>
            </span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onAskVani && (
            <button
              onClick={() => onAskVani({
                type: 'document_overview',
                prompt: `Explain the strategic rationale and key technical requirements behind "${document.title}".`
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-cyan/15 hover:bg-cyber-cyan/25 text-cyber-cyan text-xs font-bold rounded-xl border border-cyber-cyan/30 transition-all shadow-sm"
              title="Ask Vani about this document"
            >
              <Sparkles size={13} /> Ask Vani
            </button>
          )}

          {onFollowUpAction && (
            <button
              onClick={() => onFollowUpAction('research_more', `Research more current competitors, market signals, and pricing models for "${document.title}".`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold rounded-xl border border-white/10 transition-all"
            >
              <Search size={13} /> Research More
            </button>
          )}

          {onConvertToPrd && (
            <button 
              onClick={onConvertToPrd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-purple/20 hover:bg-cyber-purple/30 text-cyber-purple text-xs font-bold rounded-xl border border-cyber-purple/30 transition-all shadow-sm"
            >
              <Bot size={13} /> Create PRD
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium rounded-xl border border-white/10 transition-all"
            >
              <Download size={13} /> Export
            </button>

            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0F0C1E] border border-white/10 shadow-2xl p-1.5 z-50 text-xs">
                <button
                  onClick={() => { onExport?.('markdown'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-white/80 hover:text-white flex items-center gap-2"
                >
                  <FileText size={13} /> Markdown (.md)
                </button>
                <button
                  onClick={() => { onExport?.('json'); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-white/80 hover:text-white flex items-center gap-2"
                >
                  <Code2 size={13} /> JSON Data
                </button>
                <button
                  onClick={() => { window.print(); setShowExportDropdown(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-white/80 hover:text-white flex items-center gap-2"
                >
                  <Download size={13} /> Print / Save PDF
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleShare}
            className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
            title="Copy Document Content"
          >
            {copiedShare ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          </button>
        </div>
      </div>

      {/* ── 11 Canonical Navigation Tabs (Section 13) ────────────────────────── */}
      <div className="flex items-center px-4 py-2 border-b border-white/10 bg-white/[0.01] overflow-x-auto text-xs gap-1.5 custom-scrollbar relative z-10 shrink-0">
        {[
          { id: 'overview', label: 'Overview', icon: Target },
          { id: 'requirements', label: `Requirements (${allRequirementsCount})`, icon: ShieldCheck },
          { id: 'research', label: `Research (${sources.length})`, icon: Globe },
          { id: 'competitors', label: 'Competitors', icon: Flame },
          { id: 'personas', label: 'Personas', icon: Users },
          { id: 'workflows', label: 'Workflows', icon: Workflow },
          { id: 'risks', label: 'Risks', icon: AlertTriangle },
          { id: 'kpis', label: 'KPIs', icon: TrendingUp },
          { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'document', label: 'Document', icon: FileText },
          { id: 'versions', label: 'Versions', icon: History }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'versions') onVersionHistory?.();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30 shadow-sm font-semibold' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <IconComp size={13} className={isActive ? 'text-cyber-cyan' : 'text-white/40'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Main Tab Panels ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-2">
                    <Target size={15} /> Executive Summary
                  </h3>
                  {onAskVani && (
                    <button
                      onClick={() => onAskVani({
                        type: 'summary',
                        prompt: `Why is this executive summary and problem space critical for ${document.title}?`
                      })}
                      className="text-[11px] text-cyber-cyan hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Ask Vani
                    </button>
                  )}
                </div>
                <div className="prose prose-invert text-white/80 text-sm leading-relaxed">
                  <ReactMarkdown>{parsedSections.summary || 'Summary not explicitly provided.'}</ReactMarkdown>
                </div>
              </div>

              {/* Objectives & Goals Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <h4 className="text-xs font-bold text-cyber-purple uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Target size={14} /> Core Business Objectives
                  </h4>
                  <div className="text-xs text-white/70 leading-relaxed">
                    <ReactMarkdown>{parsedSections.objectives || 'Objectives defined across functional requirements.'}</ReactMarkdown>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={14} /> Success Goals
                  </h4>
                  <div className="text-xs text-white/70 leading-relaxed">
                    <ReactMarkdown>{parsedSections.goals || 'Goals mapped directly to sprint deliverables.'}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Fast Follow-up Action Bar */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-cyber-cyan" /> What next for this project?
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onFollowUpAction?.('create_prd', `Convert this BRD for "${document.title}" into an actionable Product Requirements Document (PRD).`)}
                    className="px-3 py-1 bg-cyber-purple/20 hover:bg-cyber-purple/30 text-cyber-purple text-xs font-semibold rounded-lg border border-cyber-purple/30 transition-all"
                  >
                    Create PRD
                  </button>
                  <button
                    onClick={() => onFollowUpAction?.('generate_roadmap', `Generate an MVP product roadmap with phase timelines for "${document.title}".`)}
                    className="px-3 py-1 bg-cyber-cyan/15 hover:bg-cyber-cyan/25 text-cyber-cyan text-xs font-semibold rounded-lg border border-cyber-cyan/30 transition-all"
                  >
                    Generate MVP Roadmap
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REQUIREMENTS (With Ask Vani on every single item) */}
          {activeTab === 'requirements' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-cyber-cyan uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={15} /> Functional Requirements ({parsedSections.frs.length})
                  </span>
                  <span className="text-[11px] text-white/40 normal-case">Click "Ask Vani" to explain any requirement</span>
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {parsedSections.frs.length > 0 ? (
                    parsedSections.frs.map((fr, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyber-cyan/30 transition-all flex flex-col gap-2.5 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
                              {fr.id}
                            </span>
                            <span className="font-semibold text-sm text-white group-hover:text-cyber-cyan transition-colors">{fr.title}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              fr.priority.toLowerCase().includes('high')
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {fr.priority}
                            </span>

                            {onAskVani && (
                              <button
                                onClick={() => onAskVani({
                                  type: 'requirement',
                                  id: fr.id,
                                  title: fr.title,
                                  prompt: `Why is requirement ${fr.id} (${fr.title}) present in "${document.title}", and what are its dependencies and implementation details?`
                                })}
                                className="px-2.5 py-0.5 bg-cyber-purple/15 hover:bg-cyber-purple/30 text-cyber-purple text-[10px] font-bold rounded-lg border border-cyber-purple/30 transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Sparkles size={10} /> Ask Vani
                              </button>
                            )}
                          </div>
                        </div>

                        {fr.description && (
                          <p className="text-xs text-white/70 leading-relaxed pl-1">{fr.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/40 pt-2 border-t border-white/5">
                          <span>Actor: <strong className="text-white/70">{fr.actor}</strong></span>
                          {fr.expectedOutcome && (
                            <span>Outcome: <strong className="text-white/70">{fr.expectedOutcome}</strong></span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-white/40">
                      Standard functional requirements detailed in Document tab.
                    </div>
                  )}
                </div>
              </div>

              {/* Non-Functional Requirements */}
              {parsedSections.nfrs.length > 0 && (
                <div className="pt-4">
                  <h3 className="text-xs font-bold text-cyber-purple uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck size={15} /> Non-Functional Requirements ({parsedSections.nfrs.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {parsedSections.nfrs.map((nfr, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate mr-2">
                          <span className="font-mono text-cyber-purple font-bold">{nfr.id}</span>
                          <span className="text-white/80 truncate">{nfr.title}</span>
                        </div>
                        {onAskVani && (
                          <button
                            onClick={() => onAskVani({
                              type: 'nfr',
                              id: nfr.id,
                              title: nfr.title,
                              prompt: `How should we architect and test ${nfr.id} (${nfr.title}) in ${document.title}?`
                            })}
                            className="text-[10px] text-white/40 hover:text-cyber-purple shrink-0 flex items-center gap-0.5"
                          >
                            <Sparkles size={9} /> Ask
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESEARCH WORKSPACE (Section 16) */}
          {activeTab === 'research' && (
            <div className="space-y-6">
              {/* Evidence Quality Header Stats */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-cyber-cyan/10 via-transparent to-cyber-purple/10 border border-cyber-cyan/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe size={16} className="text-cyber-cyan" /> Grounded Web Research Report
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Multi-query search, ranked authority sources, and structured evidence claims.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResearchFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${researchFilter === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      All ({evidenceList.length})
                    </button>
                    <button
                      onClick={() => setResearchFilter('high')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${researchFilter === 'high' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-emerald-400'}`}
                    >
                      High ({highConfidenceCount})
                    </button>
                    <button
                      onClick={() => setResearchFilter('needs_verification')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${researchFilter === 'needs_verification' ? 'bg-amber-500/20 text-amber-300' : 'text-white/40 hover:text-amber-300'}`}
                    >
                      Needs Verification ({needsVerificationCount})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-xl font-extrabold text-white">{sources.length}</div>
                    <div className="text-[11px] text-white/50 uppercase font-semibold mt-0.5">Verified Sources</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
                    <div className="text-xl font-extrabold text-emerald-400">{highConfidenceCount}</div>
                    <div className="text-[11px] text-emerald-400/80 uppercase font-semibold mt-0.5">High Confidence</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                    <div className="text-xl font-extrabold text-amber-300">{needsVerificationCount}</div>
                    <div className="text-[11px] text-amber-300/80 uppercase font-semibold mt-0.5">Needs Verification</div>
                  </div>
                </div>
              </div>

              {/* Structured Evidence Cards (Claim, Evidence, Source, Confidence) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  Grounded Evidence & Claims ({evidenceList.length})
                </h4>

                {evidenceList.length > 0 ? (
                  evidenceList
                    .filter(item => {
                      if (researchFilter === 'high') return (item.confidence || '').toLowerCase() === 'high';
                      if (researchFilter === 'needs_verification') return (item.confidence || '').toLowerCase().includes('verification');
                      return true;
                    })
                    .map((item, idx) => {
                      const isHigh = (item.confidence || '').toLowerCase() === 'high';
                      const isNeeds = (item.confidence || '').toLowerCase().includes('verification');

                      return (
                        <div 
                          key={idx} 
                          className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyber-cyan/30 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-xs text-white">{item.claim}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 border ${
                              isHigh 
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                : isNeeds 
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            }`}>
                              {item.confidence || 'Medium'}
                            </span>
                          </div>

                          <p className="text-xs text-white/70 leading-relaxed italic bg-black/20 p-2.5 rounded-xl border border-white/5">
                            "{item.evidence}"
                          </p>

                          <div className="flex flex-wrap items-center justify-between text-[11px] text-white/40 pt-1">
                            <div className="flex items-center gap-1.5 truncate max-w-sm">
                              <span>Source:</span>
                              {item.url ? (
                                <a 
                                  href={item.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-cyber-cyan hover:underline flex items-center gap-1 truncate"
                                >
                                  {item.source || item.url} <ExternalLink size={10} />
                                </a>
                              ) : (
                                <span className="text-white/60">{item.source || 'Domain index'}</span>
                              )}
                            </div>
                            {item.confidenceReason && (
                              <span className="text-[10px] text-white/40 italic">{item.confidenceReason}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-white/40 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    No individual evidence cards parsed. Check sources list below.
                  </p>
                )}
              </div>

              {/* Verified Sources List */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  Indexed Sources ({sources.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sources.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-cyber-cyan/30 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-semibold text-white group-hover:text-cyber-cyan transition-colors truncate">
                            {s.title || 'Web Source'}
                          </span>
                          <ExternalLink size={12} className="text-white/20 group-hover:text-cyber-cyan shrink-0 transition-colors" />
                        </div>
                        <p className="text-[11px] text-white/50 line-clamp-2">{s.snippet || 'Indexed page source'}</p>
                      </div>
                      <span className="text-[10px] text-cyber-cyan/70 font-mono mt-2 truncate">{s.domain || s.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPETITORS */}
          {activeTab === 'competitors' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Flame size={15} /> Competitive Landscape & Positioning
                  </h3>
                  {onAskVani && (
                    <button
                      onClick={() => onAskVani({
                        type: 'competitors',
                        prompt: `Compare the key competitors identified for "${document.title}", their pricing, and our unique moat.`
                      })}
                      className="text-[11px] text-cyber-cyan hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Ask Vani
                    </button>
                  )}
                </div>
                <div className="prose prose-invert text-white/80 text-sm leading-relaxed">
                  <ReactMarkdown>{parsedSections.competitors || 'Competitor analysis detailed in Document tab.'}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PERSONAS */}
          {activeTab === 'personas' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-cyber-purple uppercase tracking-wider flex items-center gap-2">
                    <Users size={15} /> Target Users & Buyer Personas
                  </h3>
                  {onAskVani && (
                    <button
                      onClick={() => onAskVani({
                        type: 'personas',
                        prompt: `Who are the core customer personas for "${document.title}", and what are their primary pain points?`
                      })}
                      className="text-[11px] text-cyber-purple hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Ask Vani
                    </button>
                  )}
                </div>
                <div className="prose prose-invert text-white/80 text-sm leading-relaxed">
                  <ReactMarkdown>{parsedSections.personas || 'Personas detailed in Document tab.'}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: WORKFLOWS */}
          {activeTab === 'workflows' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 shadow-lg">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Workflow size={15} /> User Workflows & System Business Rules
                </h3>
                <div className="prose prose-invert text-white/80 text-sm leading-relaxed space-y-4">
                  <ReactMarkdown>{parsedSections.workflows || 'Workflows detailed in Document tab.'}</ReactMarkdown>
                  {parsedSections.rules && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-bold text-white/70 uppercase mb-2">Business Rules</h4>
                      <ReactMarkdown>{parsedSections.rules}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: RISKS */}
          {activeTab === 'risks' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={15} /> Risks & Mitigation Matrix
              </h3>
              {parsedSections.risks.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {parsedSections.risks.map((risk, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-white/80 flex items-start gap-3">
                      <span className="text-amber-400 text-sm mt-0.5">⚠</span>
                      <div className="flex-1">
                        <span>{risk}</span>
                      </div>
                      {onAskVani && (
                        <button
                          onClick={() => onAskVani({
                            type: 'risk',
                            prompt: `How should we mitigate this risk in "${document.title}": "${risk}"?`
                          })}
                          className="text-[10px] text-amber-300 hover:underline shrink-0"
                        >
                          Mitigate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  See Section 21 in full document for complete risk assessment.
                </p>
              )}
            </div>
          )}

          {/* TAB 8: KPIS */}
          {activeTab === 'kpis' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={15} /> Measurable KPIs & Success Milestones
              </h3>
              {parsedSections.kpis.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {parsedSections.kpis.map((kpi, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs text-white/80 flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span>{kpi}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  See Section 22 in full document for KPI details.
                </p>
              )}
            </div>
          )}

          {/* TAB 9: TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare size={15} /> Extracted Implementation Tasks ({tasks.length})
                </h3>
              </div>

              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {tasks.map((task, idx) => (
                    <div 
                      key={task.id || idx}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 flex items-center justify-between text-xs transition-all"
                    >
                      <div className="flex items-center gap-2.5 truncate mr-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          task.status === 'done' ? 'bg-emerald-400' : 'bg-cyber-cyan'
                        }`} />
                        <span className="font-medium text-white truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-white/10 text-white/60'
                        }`}>
                          {task.priority || 'medium'}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/50">
                          {task.status || 'pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  No tasks linked to this document yet.
                </p>
              )}
            </div>
          )}

          {/* TAB 10: COMPLETE DOCUMENT */}
          {activeTab === 'document' && (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-2xl">
              <div className="prose prose-invert max-w-none text-white/90 text-sm leading-relaxed">
                <ReactMarkdown>{document.content || ''}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* TAB 11: VERSIONS */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-cyber-purple uppercase tracking-wider flex items-center gap-2">
                <History size={15} /> Version History & Restore Snapshots
              </h3>

              {previewVersion && (
                <div className="p-4 rounded-xl bg-cyber-purple/[0.08] border border-cyber-purple/30 mb-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyber-purple" />
                      Previewing Snapshot: {previewVersion.versionName}
                    </span>
                    <button
                      onClick={() => handleRestore(previewVersion)}
                      disabled={restoringId === previewVersion.id}
                      className="px-3 py-1.5 bg-cyber-purple hover:bg-cyber-purple/80 text-white font-bold rounded-lg transition-all text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <History size={13} />
                      {restoringId === previewVersion.id ? 'Restoring...' : 'Restore This Version'}
                    </button>
                  </div>
                  <div className="text-xs text-white/70 max-h-48 overflow-y-auto font-mono p-3 bg-black/40 rounded-lg border border-white/5 whitespace-pre-wrap">
                    {previewVersion.content}
                  </div>
                </div>
              )}

              {versionsLoading ? (
                <p className="text-xs text-white/50">Loading versions...</p>
              ) : versionsList.length > 0 ? (
                <div className="space-y-3">
                  {versionsList.map((ver, idx) => (
                    <div 
                      key={ver.id || idx}
                      onClick={() => setPreviewVersion(ver)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        previewVersion?.id === ver.id
                          ? 'bg-cyber-purple/10 border-cyber-purple/40 ring-1 ring-cyber-purple/30'
                          : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{ver.versionName || `Version ${versionsList.length - idx}`}</span>
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">Current</span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5">
                          {new Date(ver.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(ver);
                          }}
                          disabled={restoringId === ver.id}
                          className="px-3 py-1 bg-cyber-purple/20 hover:bg-cyber-purple/30 text-cyber-purple font-bold rounded-lg border border-cyber-purple/30 transition-all text-xs"
                        >
                          {restoringId === ver.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  No previous versions recorded for this document yet.
                </p>
              )}
            </div>
          )}

          {/* ── Follow-Up Action Bar (Section 15) ────────────────────────────── */}
          <div className="pt-6 border-t border-white/10 mt-8">
            <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-cyber-cyan" /> Next Project Milestones
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { title: 'Create PRD', action: 'create_prd', prompt: `Create a detailed Product Requirements Document (PRD) from this BRD for "${document.title}".` },
                { title: 'Generate MVP Roadmap', action: 'generate_roadmap', prompt: `Generate a phased milestone MVP roadmap for "${document.title}".` },
                { title: 'Create User Stories', action: 'create_user_stories', prompt: `Create agile user stories with Gherkin acceptance criteria for "${document.title}".` },
                { title: 'Technical Architecture', action: 'create_tech_arch', prompt: `Design the complete technical architecture, API schema, and database design for "${document.title}".` },
                { title: 'Research More Competitors', action: 'research_more', prompt: `Conduct deep competitor pricing and market research for "${document.title}".` },
                { title: 'Create Pitch Deck', action: 'create_pitch_deck', prompt: `Generate an investor pitch deck structure and market strategy for "${document.title}".` }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onFollowUpAction?.(item.action, item.prompt)}
                  className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-cyber-cyan/30 text-left transition-all group flex flex-col justify-between"
                >
                  <span className="text-xs font-semibold text-white/90 group-hover:text-cyber-cyan transition-colors">
                    {item.title}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                    <span>Continue project</span>
                    <ArrowRight size={11} className="text-white/20 group-hover:text-cyber-cyan transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
