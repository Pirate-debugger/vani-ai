import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bot, ArrowLeft, Plus, Search, Activity, Plug } from 'lucide-react';
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

  if (loading) return <div className="p-8 text-white">Loading Project...</div>;
  if (!project) return <div className="p-8 text-white">Project not found</div>;

  const selectedDoc = (project.documents || []).find(d => d.id === selectedDocId) || (project.documents || [])[0];

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
            <span className="text-sm font-bold text-white">Health Score: <span className="text-cyber-cyan">85/100</span></span>
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
                  onClick={() => setSelectedDocId(doc.id)}
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
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:border-cyber-cyan/30 hover:bg-cyber-cyan/5 transition-all cursor-pointer group">
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
          {activeTab === 'integrations' ? (
            <IntegrationsPanel />
          ) : selectedDoc?.type === 'roadmap' ? (
            <RoadmapTimeline document={selectedDoc} />
          ) : (
            <DocumentViewer 
              document={selectedDoc} 
              onExport={(format) => alert(`Exporting as ${format}...`)}
              onVersionHistory={() => alert('Version history coming soon')}
              onConvertToPrd={selectedDoc?.type === 'brd' ? () => alert('Converting to PRD...') : null}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Project;
