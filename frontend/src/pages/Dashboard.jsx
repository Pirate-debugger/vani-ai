import React, { useState, useEffect } from 'react';
import { Plus, Folder, FileText, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Mocking for now, will connect to backend API later
    const fetchProjects = async () => {
      try {
        // const res = await axios.get('/api/projects', { withCredentials: true });
        // setProjects(res.data);
        setProjects([
          { id: '1', name: 'Swiggy for Villages', status: 'active', documents: [{ id: 'd1', type: 'brd', title: 'Initial BRD' }] }
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

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
        <button className="flex items-center gap-2 px-4 py-2 bg-cyber-cyan text-cyber-bg font-bold rounded-lg hover:bg-cyber-cyan/90 transition-all">
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
            <button className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg border border-white/10 transition-all">
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
                {proj.documents?.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm text-white/70">
                    <FileText size={14} className="text-cyber-purple" />
                    <span className="flex-1 truncate">{doc.title} ({doc.type.toUpperCase()})</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-white/40 group-hover:text-cyber-cyan/80 transition-colors">
                <span>View Workspace</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
