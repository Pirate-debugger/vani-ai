import React, { useState, useEffect } from 'react';
import { Plus, Folder, FileText, ChevronRight, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects', { withCredentials: true });
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setNewProjectName('');
    setNewProjectDesc('');
    setShowCreateModal(true);
  };

  const submitCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreateLoading(true);
    try {
      const res = await axios.post('/api/projects', {
        name: newProjectName.trim(),
        description: newProjectDesc.trim()
      }, { withCredentials: true });

      setProjects([res.data, ...projects]);
      setShowCreateModal(false);
      navigate(`/project/${res.data.id}`);
    } catch (error) {
      console.error("Failed to create project", error);
      alert("Failed to create project. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-white">Loading projects...</div>;
  }

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-10 text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-cyber-cyan bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Welcome back, {user?.name || 'User'}</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all">
          <Plus size={18} />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-panel rounded-xl border border-white/5">
            <Folder size={48} className="text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No projects yet</h3>
            <p className="text-sm text-white/40 mt-1 mb-4">Create your first product intelligence project.</p>
            <button onClick={openCreateModal} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg border border-white/10 transition-all">
              Create Project
            </button>
          </div>
        ) : (
          projects.map(proj => (
            <div key={proj.id} className="glass-panel p-5 rounded-xl border border-white/10 hover:border-cyber-cyan/40 transition-all cursor-pointer group" onClick={() => navigate(`/project/${proj.id}`)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white group-hover:text-cyber-cyan transition-colors">{proj.name}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
                  {proj.status}
                </span>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">Recent Documents</p>
                {proj.documents && proj.documents.length > 0 ? proj.documents.slice(0, 3).map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm text-white/70">
                    <FileText size={14} className="text-cyber-purple" />
                    <span className="flex-1 truncate">{doc.title} ({doc.type.toUpperCase()})</span>
                  </div>
                )) : <p className="text-xs text-white/30">No documents generated yet</p>}
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-white/40 group-hover:text-cyber-cyan/80 transition-colors">
                <span>View Workspace</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel border border-white/10 w-full max-w-md rounded-xl overflow-hidden bg-[#0e0a1f] p-6 shadow-2xl relative">
            <div className="absolute top-4 right-4">
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors"
                disabled={createLoading}
              >
                <X size={18} />
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Folder className="text-cyber-cyan" size={24} />
              Create New Project
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Bharat split-payment app"
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan/40"
                  disabled={createLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Describe your startup vision or details..."
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-cyan/40 resize-none"
                  disabled={createLoading}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 font-semibold mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                disabled={createLoading}
              >
                Cancel
              </button>
              <button
                onClick={submitCreateProject}
                disabled={!newProjectName.trim() || createLoading}
                className="px-5 py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createLoading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
