import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  Globe, 
  Cpu, 
  Shield, 
  Check, 
  FileText, 
  Database, 
  Layers, 
  Sliders, 
  Zap, 
  CheckSquare, 
  Folder
} from 'lucide-react';
import axios from 'axios';

export default function CustomAgentModal({ isOpen, onClose, onAgentCreated }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [preferredModel, setPreferredModel] = useState('auto'); // 'auto' | 'openai' | 'gemini' | 'sarvam'
  const [tools, setTools] = useState(['web_search', 'web_fetch', 'project_knowledge', 'documents']);
  const [autonomy, setAutonomy] = useState('auto_execute'); // 'ask_before' | 'auto_execute' | 'manual'
  const [languages, setLanguages] = useState(['hi', 'en', 'hinglish']);
  const [outputStyle, setOutputStyle] = useState('detailed'); // 'concise' | 'detailed' | 'structured'

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoadingTemplates(true);
      axios.get('/api/agents/templates', { withCredentials: true })
        .then(res => {
          if (Array.isArray(res.data)) {
            setTemplates(res.data);
          }
        })
        .catch(err => {
          console.warn('Failed to load agent templates:', err.message);
        })
        .finally(() => setLoadingTemplates(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplateKey(tpl.id || tpl.name);
    setName(tpl.name || '');
    setDescription(tpl.description || '');
    setInstructions(tpl.instructions || '');
    setPreferredModel(tpl.preferredModel || 'auto');
    setTools(Array.isArray(tpl.tools) ? tpl.tools : ['web_search', 'web_fetch']);
    setAutonomy(tpl.autonomy || 'auto_execute');
    setLanguages(Array.isArray(tpl.language) ? tpl.language : ['hi', 'en']);
    setOutputStyle(tpl.outputStyle || 'detailed');
  };

  const toggleTool = (toolKey) => {
    setTools(prev => 
      prev.includes(toolKey) ? prev.filter(t => t !== toolKey) : [...prev, toolKey]
    );
  };

  const toggleLanguage = (langKey) => {
    setLanguages(prev => 
      prev.includes(langKey) ? prev.filter(l => l !== langKey) : [...prev, langKey]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for your custom agent.');
      return;
    }
    if (!instructions.trim()) {
      setError('Please provide instructions/prompting for your agent.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        preferredModel,
        tools,
        autonomy,
        language: languages,
        outputStyle
      };

      const res = await axios.post('/api/agents/custom', payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });

      if (onAgentCreated) {
        onAgentCreated(res.data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create custom agent:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-3xl max-h-[90vh] bg-[#0c0919] border border-cyan-500/25 rounded-2xl shadow-2xl shadow-cyan-950/40 flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-glow-cyan">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Custom Agent Builder
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Vani 2.0
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Design autonomous AI specialists tailored for your workflows and domain memory.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Section: Templates Carousel/Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                Start from a Curated Template
              </label>
              <span className="text-[11px] text-white/40">Optional · Click to prefill</span>
            </div>

            {loadingTemplates ? (
              <div className="py-4 text-center text-xs text-white/40 animate-pulse">Loading templates...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {templates.map(tpl => {
                  const isSelected = selectedTemplateKey === (tpl.id || tpl.name);
                  return (
                    <button
                      key={tpl.id || tpl.name}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected 
                          ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-glow-cyan' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div className="font-semibold text-xs truncate">{tpl.name}</div>
                      <div className="text-[10px] text-white/40 line-clamp-1 mt-0.5">{tpl.description}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form */}
          <form id="custom-agent-form" onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Startup Researcher, Code Reviewer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/30 text-xs focus:outline-none focus:border-cyan-400 focus:bg-white/[0.06] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  placeholder="What does this agent specialize in?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/30 text-xs focus:outline-none focus:border-cyan-400 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Instructions / Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-white/80">
                  Agent Instructions & Behavioral Rules *
                </label>
                <span className="text-[11px] text-white/40 font-mono">Custom Prompt</span>
              </div>
              <textarea
                required
                rows={5}
                placeholder="Give your agent its personality, operational checklist, formatting rules, and strict constraints..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-cyan-400 focus:bg-white/[0.06] transition-all custom-scrollbar resize-y"
              />
            </div>

            {/* Preferred Model */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-2">
                Preferred Intelligence Engine
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'auto', label: '✨ Auto Router', sub: 'Optimal by task' },
                  { id: 'openai', label: '⚙ OpenAI GPT-4o', sub: 'Coding & Architecture' },
                  { id: 'gemini', label: '📋 Gemini 2.5', sub: 'BRD, PRD & Research' },
                  { id: 'sarvam', label: '🎙 Sarvam AI', sub: 'Indic & Voice First' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPreferredModel(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preferredModel === m.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="font-semibold text-xs">{m.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tools Checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-2">
                Accessible Capabilities & Tools
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'web_search', label: 'TinyFish Web Search', desc: 'Live competitor discovery' },
                  { id: 'web_fetch', label: 'TinyFish Web Fetch', desc: 'Extract page evidence' },
                  { id: 'browser', label: 'Browser Automation', desc: 'Interactive web flows' },
                  { id: 'project_knowledge', label: 'Project Knowledge', desc: 'Active workspace context' },
                  { id: 'documents', label: 'Document Artifacts', desc: 'BRD / PRD / Specs' },
                  { id: 'external_integrations', label: 'External Integrations', desc: 'GitHub, Jira, APIs' }
                ].map(t => {
                  const checked = tools.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleTool(t.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer select-none flex items-start gap-2.5 transition-all ${
                        checked 
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-white' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/20'
                      }`}>
                        {checked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white">{t.label}</div>
                        <div className="text-[10px] text-white/40 line-clamp-1">{t.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Autonomy Level */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-2">
                Autonomy Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ask_before', label: 'Ask Before Actions', sub: 'Interactive confirmation' },
                  { id: 'auto_execute', label: '● Auto Execute', sub: 'Autonomous execution' },
                  { id: 'manual', label: 'Manual Approval', sub: 'Step-by-step gate' }
                ].map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAutonomy(a.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      autonomy === a.id
                        ? 'bg-indigo-500/15 border-indigo-400 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="font-semibold text-xs">{a.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{a.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Language & Output Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2">
                  Supported Languages
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'hi', label: 'Hindi' },
                    { id: 'en', label: 'English' },
                    { id: 'hinglish', label: 'Hinglish' }
                  ].map(l => {
                    const checked = languages.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLanguage(l.id)}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                          checked
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-white/[0.02] border-white/[0.08] text-white/50 hover:bg-white/[0.05]'
                        }`}
                      >
                        {checked ? `✓ ${l.label}` : l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2">
                  Output Style
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'concise', label: 'Concise' },
                    { id: 'detailed', label: 'Detailed' },
                    { id: 'structured', label: 'Structured' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setOutputStyle(s.id)}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                        outputStyle === s.id
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                          : 'bg-white/[0.02] border-white/[0.08] text-white/50 hover:bg-white/[0.05]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/[0.08] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="custom-agent-form"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold text-xs shadow-glow-cyan hover:opacity-95 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <Sparkles size={14} className="animate-spin" />
                Creating Agent...
              </>
            ) : (
              <>
                <Bot size={14} />
                Create Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
