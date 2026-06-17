import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bot, ArrowLeft, Plus, Search, Activity, Plug, X, History } from 'lucide-react';
import DocumentViewer from '../components/DocumentViewer';
import RoadmapTimeline from '../components/RoadmapTimeline';
import IntegrationsPanel from '../components/IntegrationsPanel';

const AGENTS = [
  { id: 'brd', label: 'BRD Agent', desc: 'Generate Business Requirements' },
  { id: 'prd', label: 'PRD Agent', desc: 'Generate Product Requirements' },
  { id: 'startup', label: 'Startup Copilot', desc: 'Generate Startup Plan' },
  { id: 'roadmap', label: 'Roadmap Agent', desc: 'Create Product Timeline' },
  { id: 'user_story', label: 'User Story Agent', desc: 'Create Agile Stories' },
  { id: 'idea_validation', label: 'Idea Validation', desc: 'Analyze Market & Risk' },
  { id: 'investor', label: 'Investor Pitch', desc: 'Generate Pitch Deck' },
  { id: 'hackathon', label: 'Hackathon Mode', desc: 'Generate Hackathon Package' }
];

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' or 'integrations'

  // Agent State
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);

  // Version History State
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [documentVersions, setDocumentVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionLoading, setVersionLoading] = useState(false);

  // Convert to PRD State
  const [convertLoading, setConvertLoading] = useState(false);

  const fetchProject = async () => {
    try {
      const res = await axios.get(`/api/projects/${id}`, { withCredentials: true });
      setProject(res.data);
    } catch (error) {
      console.error("Failed to load project", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  // Expose a way to refresh the project (e.g., after generating a document)
  useEffect(() => {
    const handleDocumentCreated = () => fetchProject();
    window.addEventListener('vani_document_created', handleDocumentCreated);
    return () => window.removeEventListener('vani_document_created', handleDocumentCreated);
  }, [id]);

  // Fetch document versions when version history panel is shown
  const fetchVersions = async () => {
    if (!selectedDoc?.id) return;
    setVersionLoading(true);
    try {
      const res = await axios.get(`/api/document/${selectedDoc.id}`, { withCredentials: true });
      setDocumentVersions(res.data.versions || []);
    } catch (error) {
      console.error("Failed to load versions", error);
    } finally {
      setVersionLoading(false);
    }
  };

  const selectedDoc = (project.documents || []).find(d => d.id === selectedDocId) || (project.documents || [])[0];

  useEffect(() => {
    if (showVersionHistory && selectedDoc?.id) {
      fetchVersions();
    } else {
      setDocumentVersions([]);
      setSelectedVersion(null);
    }
  }, [showVersionHistory, selectedDoc?.id]);

  const documentToView = selectedDoc && selectedVersion 
    ? { ...selectedDoc, content: selectedVersion.content, title: `${selectedDoc.title} (${selectedVersion.versionName})`, isVersionPreview: true }
    : selectedDoc;

  const handleRunAgent = async () => {
    if (!selectedAgent || !agentPrompt.trim()) return;
    setAgentLoading(true);
    try {
      const res = await axios.post('/api/ai/chat', {
        prompt: agentPrompt,
        projectId: id,
        agentType: selectedAgent.id,
        messages: []
      }, { withCredentials: true });

      setSelectedAgent(null);
      setAgentPrompt('');
      
      // Dispatch document created event
      window.dispatchEvent(new Event('vani_document_created'));

      if (res.data && res.data.documentId) {
        setSelectedDocId(res.data.documentId);
      }
    } catch (error) {
      console.error("Agent execution failed", error);
      alert(error.response?.data?.error || "Agent execution failed. Please verify your API keys in Settings.");
    } finally {
      setAgentLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!selectedDoc) return;
    try {
      const response = await axios.get(`/api/export/${selectedDoc.id}/${format}`, {
        responseType: 'blob',
        withCredentials: true
      });
      
      const mimeTypes = {
        md: 'text/markdown',
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      
      const blob = new Blob([response.data], { type: mimeTypes[format] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedDoc.title.replace(/\s+/g, '_')}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export document.");
    }
  };

  const handleConvertToPrd = async () => {
    if (!selectedDoc || selectedDoc.type !== 'brd') return;
    setConvertLoading(true);
    try {
      const res = await axios.post(`/api/document/${selectedDoc.id}/convert`, {
        targetType: 'prd'
      }, { withCredentials: true });

      window.dispatchEvent(new Event('vani_document_created'));

      if (res.data && res.data.documentId) {
        setSelectedDocId(res.data.documentId);
      }
    } catch (error) {
      console.error("PRD Conversion failed", error);
      alert("Failed to convert document to PRD. Please check your AI keys.");
    } finally {
      setConvertLoading(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedDoc || !selectedVersion) return;
    try {
      await axios.put(`/api/document/${selectedDoc.id}`, {
        content: selectedVersion.content,
        title: selectedDoc.title
      }, { withCredentials: true });

      setSelectedVersion(null);
      setShowVersionHistory(false);
      await fetchProject();
      alert("Document successfully restored to selected version!");
    } catch (error) {
      console.error("Failed to restore version", error);
      alert("Failed to restore document version.");
    }
  };

  if (loading) return <div className="p-8 text-white">Loading Project...</div>;
  if (!project) return <div className="p-8 text-white">Project not found</div>;

  const docCount = (project.documents || []).length;
  const healthScore = Math.min(100, Math.round((docCount / 8) * 100));

  return (
    <div className="flex flex-col h-full bg-cyber-bg relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5 glass-panel z-20 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <p className="text-xs text-white/40">Bharat Startup Copilot Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-cyber-purple/10 border border-cyber-purple/30 rounded-full">
            <Activity size={16} className="text-cyber-cyan" />
            <span className="text-sm font-bold text-white">Health Score: <span className="text-cyber-cyan">{healthScore}/100</span></span>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
            <button onClick={() => setActiveTab('documents')} className={`px-4 py-1 text-sm font-bold rounded-md transition-all ${activeTab === 'documents' ? 'bg-cyber-purple text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
              Documents
            </button>
            <button onClick={() => setActiveTab('integrations')} className={`px-4 py-1 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'integrations' ? 'bg-cyber-purple text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
              <Plug size={14} /> Integrations
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden z-10 relative">
        {/* Left Sidebar - Documents & Agents */}
        <div className="w-72 glass-panel border-r border-white/5 flex flex-col h-full overflow-y-auto custom-scrollbar">
          
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Project Documents</h3>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input 
                type="text" 
                placeholder="Search docs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan/30 transition-all"
              />
            </div>
            <div className="space-y-1">
              {(project.documents || []).filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase())).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setSelectedVersion(null); // Clear preview when changing documents
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    (selectedDocId === doc.id || (!selectedDocId && (project.documents || [])[0]?.id === doc.id))
                      ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {doc.title}
                </button>
              ))}
              {(!project.documents || project.documents.length === 0) && <p className="text-xs text-white/30 p-2">No documents yet.</p>}
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">Run AI Agents</h3>
            <div className="space-y-2">
              {AGENTS.map(agent => (
                <div 
                  key={agent.id} 
                  onClick={() => {
                    setSelectedAgent(agent);
                    setAgentPrompt('');
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:border-cyber-cyan/30 hover:bg-cyber-cyan/5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Bot size={16} className="text-cyber-purple group-hover:text-cyber-cyan transition-colors" />
                    <div>
                      <p className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">{agent.label}</p>
                      <p className="text-[10px] text-white/40">{agent.desc}</p>
                    </div>
                  </div>
                  <Plus size={14} className="text-white/20 group-hover:text-cyber-cyan" />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 h-full overflow-hidden relative">
          {convertLoading && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-xl">
              <div className="w-12 h-12 border-4 border-cyber-purple border-t-cyber-cyan rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-semibold text-white/80 animate-pulse">Converting Document to PRD... Please wait</p>
            </div>
          )}
          {activeTab === 'integrations' ? (
            <IntegrationsPanel />
          ) : documentToView?.type === 'roadmap' ? (
            <RoadmapTimeline document={documentToView} />
          ) : (
            <DocumentViewer 
              document={documentToView} 
              onExport={handleExport}
              onVersionHistory={() => setShowVersionHistory(!showVersionHistory)}
              onConvertToPrd={selectedDoc?.type === 'brd' ? handleConvertToPrd : null}
              onRestoreVersion={handleRestoreVersion}
              onClosePreview={() => setSelectedVersion(null)}
            />
          )}
        </div>

        {/* Version History Sidebar */}
        {showVersionHistory && (
          <div className="w-80 glass-panel border-l border-white/5 flex flex-col h-full bg-[#0a0714] z-20">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyber-cyan" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Version History</h3>
              </div>
              <button 
                onClick={() => { setShowVersionHistory(false); setSelectedVersion(null); }}
                className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {versionLoading ? (
                <div className="text-center py-8 text-xs text-white/40 animate-pulse">Loading version history...</div>
              ) : documentVersions.length === 0 ? (
                <div className="text-center py-8 text-xs text-white/40">No versions found.</div>
              ) : (
                documentVersions.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersion(selectedVersion?.id === ver.id ? null : ver)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                      selectedVersion?.id === ver.id
                        ? 'bg-cyber-purple/20 border-cyber-purple/50 text-white'
                        : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-cyber-cyan">{ver.versionName || 'Unnamed Version'}</span>
                      <span className="text-[10px] text-white/30">{new Date(ver.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="line-clamp-2 text-[11px] text-white/50">{ver.content}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Agent Runner Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel border border-white/10 w-full max-w-lg rounded-xl overflow-hidden bg-[#0e0a1f] p-6 shadow-2xl relative">
            <div className="absolute top-4 right-4">
              <button 
                onClick={() => setSelectedAgent(null)} 
                className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors"
                disabled={agentLoading}
              >
                <X size={18} />
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Bot className="text-cyber-cyan animate-pulse" size={24} />
              Run {selectedAgent.label}
            </h2>
            <p className="text-xs text-white/50 mb-4">{selectedAgent.desc}</p>
            
            {agentLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-cyber-purple border-t-cyber-cyan rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-white/80 animate-pulse text-center">
                  AI Agent is crafting your document... <br />
                  <span className="text-xs text-white/40">This may take up to 30 seconds.</span>
                </p>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Describe your concept / Provide instructions:
                </label>
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  placeholder={`Tell the agent what you want to build or generate. Provide as many details as possible for better results...`}
                  className="w-full h-36 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan/40 mb-6 resize-none"
                />
                <div className="flex justify-end gap-3 font-semibold">
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="px-4 py-2 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunAgent}
                    disabled={!agentPrompt.trim()}
                    className="px-5 py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Document
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Project;
