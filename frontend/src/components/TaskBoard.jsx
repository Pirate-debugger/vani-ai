import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, PlayCircle, User, ListTodo } from 'lucide-react';

const TaskBoard = ({ tasks: initialTasks = [], projectId }) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setTasks(initialTasks);
    }
  }, [initialTasks]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/tasks`);
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

    fetchTasks();
  }, [projectId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-500/15 border border-green-500/30 text-green-400">
            <CheckCircle2 size={12} />
            Done
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan">
            <PlayCircle size={12} className="animate-pulse" />
            In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
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

  if (!tasks || tasks.length === 0) {
    if (loading) {
      return (
        <div className="w-full glass-panel border-white/5 p-4 rounded-2xl text-center text-white/50 text-xs">
          Loading tasks...
        </div>
      );
    }
    return null;
  }

  return (
    <div className="w-full glass-panel border-white/10 backdrop-blur-xl p-4 sm:p-5 rounded-2xl shadow-glass mt-4">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-cyber-cyan" />
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white/80">
            Extracted Action Items ({tasks.length})
          </h3>
        </div>
        <span className="text-[10px] text-white/40 font-mono">Project Tasks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
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
              <div>{getStatusBadge(task.status)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskBoard;
