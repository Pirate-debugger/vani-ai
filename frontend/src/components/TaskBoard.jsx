import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, PlayCircle, User, ListTodo, Plus, RefreshCw } from 'lucide-react';

const TaskBoard = ({ tasks: initialTasks = [], projectId, onTaskUpdated }) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setTasks(initialTasks);
    }
  }, [initialTasks]);

  const fetchTasks = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks for project:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const handleStatusToggle = async (task) => {
    const nextStatusMap = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending'
    };
    const nextStatus = nextStatusMap[task.status] || 'pending';
    setUpdatingId(task.id);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        if (onTaskUpdated) onTaskUpdated(updated);
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status, isUpdating) => {
    if (isUpdating) {
      return (
        <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/10 text-white/60 animate-pulse">
          <RefreshCw size={10} className="animate-spin" /> Saving...
        </span>
      );
    }

    switch (status) {
      case 'done':
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-all">
            <CheckCircle2 size={12} />
            Done
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/25 transition-all">
            <PlayCircle size={12} className="animate-pulse" />
            In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all">
            <Clock size={12} />
            Pending
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || 'medium').toLowerCase();
    let colorClass = 'text-white/40 border-white/10';
    if (p === 'high') colorClass = 'text-red-400 border-red-500/20 bg-red-500/10';
    else if (p === 'medium') colorClass = 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10';
    else if (p === 'low') colorClass = 'text-blue-400 border-blue-500/20 bg-blue-500/10';

    return (
      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${colorClass}`}>
        {p}
      </span>
    );
  };

  if (loading && (!tasks || tasks.length === 0)) {
    return (
      <div className="w-full glass-panel border-white/5 p-8 rounded-2xl text-center text-white/50 text-xs">
        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-cyber-cyan" />
        Loading tasks...
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="w-full glass-panel border-white/5 p-8 rounded-2xl text-center text-white/50 text-xs">
        <ListTodo size={32} className="mx-auto mb-3 text-white/20" />
        <p className="font-bold text-white/70 mb-1">No action items found yet</p>
        <p className="text-white/40">Generate a BRD or PRD to extract implementation tasks automatically, or speak to Vani to create tasks.</p>
      </div>
    );
  }

  return (
    <div className="w-full glass-panel border-white/10 backdrop-blur-xl p-4 sm:p-5 rounded-2xl shadow-glass mt-4">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-cyber-cyan" />
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white/80">
            Action Items ({tasks.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 font-mono hidden sm:inline">Click status to cycle</span>
          <button
            onClick={fetchTasks}
            className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
            title="Refresh tasks"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {tasks.map((task, idx) => (
          <div
            key={task.id || idx}
            className="flex flex-col justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyber-cyan/30 transition-all hover:bg-white/[0.05]"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-white/90 line-clamp-2">
                  <span className="text-cyber-cyan font-mono mr-1.5">#{idx + 1}</span>
                  {task.title}
                </span>
                {getPriorityBadge(task.priority)}
              </div>
              {task.description && (
                <p className="text-[11px] text-white/50 line-clamp-2 mb-2">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
              <div className="flex items-center gap-1.5 text-white/60">
                <User size={12} className="text-cyber-cyan/70" />
                <span className="truncate max-w-[110px] font-medium">
                  {task.assignee || 'Unassigned'}
                </span>
              </div>
              <button
                onClick={() => handleStatusToggle(task)}
                disabled={updatingId === task.id}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                title="Click to cycle status"
              >
                {getStatusBadge(task.status, updatingId === task.id)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskBoard;
