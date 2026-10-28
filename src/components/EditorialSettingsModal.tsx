import React, { useState } from 'react';
import { useBookStore } from '../store/useBookStore';
import { EditorialPreferences, SuggestionType } from '../lib/supabase';

interface EditorialSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditorialSettingsModal: React.FC<EditorialSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    editorialPreferences,
    learningState,
    updateEditorialPreferences,
    resetLearning,
  } = useBookStore();

  const [formData, setFormData] = useState<EditorialPreferences>({
    ...editorialPreferences,
  });
  const [activeTab, setActiveTab] = useState<'voice' | 'categories' | 'engine' | 'learning'>('voice');
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateEditorialPreferences(formData);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  const toggleCategory = (cat: SuggestionType) => {
    setFormData((prev) => ({
      ...prev,
      enabledCategories: {
        ...prev.enabledCategories,
        [cat]: !prev.enabledCategories[cat],
      },
    }));
  };

  const handleResetLearningState = () => {
    if (confirm('Reset all learned dismissal patterns and preference history?')) {
      resetLearning();
    }
  };

  const categories: Array<{ key: SuggestionType; label: string; desc: string }> = [
    { key: 'grammar', label: 'Grammar & Mechanics', desc: 'Agreement, punctuation, typos, and homophones' },
    { key: 'articulation', label: 'Articulation & Phrasing', desc: 'Clarity, conciseness, and eliminating bloat' },
    { key: 'style', label: 'Style & Voice', desc: 'Evocative verbs, active voice, and avoiding clichés' },
    { key: 'continuity', label: 'Continuity & Lore', desc: 'Consistency with previous chapter facts & character bible' },
    { key: 'pacing', label: 'Pacing & Rhythm', desc: 'Sentence length variance, breath, and cadence' },
    { key: 'structure', label: 'Structure & Flow', desc: 'Paragraph transitions and narrative cohesion' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Editorial Partner Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tune your AI editor's voice, intervention level, and continuous learning
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'voice'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Voice & Tone
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('engine')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'engine'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            AI Engine & Keys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('learning')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'learning'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Learned Habits
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {activeTab === 'voice' && (
            <div className="space-y-5">
              {/* Intervention Level */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Intervention Level
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Controls how frequently and aggressively the editor intervenes.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'minimal', title: 'Minimal', sub: 'High impact & errors only' },
                    { id: 'balanced', title: 'Balanced', sub: 'Thoughtful line edits' },
                    { id: 'active', title: 'Active', sub: 'In-depth developmental' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, interventionLevel: lvl.id as any })
                      }
                      className={`p-3 text-left rounded-xl border transition-all ${
                        formData.interventionLevel === lvl.id
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">{lvl.title}</div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          formData.interventionLevel === lvl.id
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {lvl.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Tone */}
              <div>
                <label htmlFor="preferred-tone" className="block font-semibold text-slate-800 mb-1">
                  Target Editorial Tone
                </label>
                <select
                  id="preferred-tone"
                  value={formData.preferredTone}
                  onChange={(e) =>
                    setFormData({ ...formData, preferredTone: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="preserve">Preserve My Natural Voice (Recommended)</option>
                  <option value="literary">Literary & Atmospheric</option>
                  <option value="minimalist">Punchy & Minimalist</option>
                  <option value="conversational">Conversational & Natural</option>
                  <option value="formal">Polished & Formal</option>
                </select>
              </div>

              {/* Target Audience */}
              <div>
                <label htmlFor="target-audience" className="block font-semibold text-slate-800 mb-1">
                  Target Audience
                </label>
                <select
                  id="target-audience"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="general">General Adult Fiction & Non-Fiction</option>
                  <option value="young_adult">Young Adult (YA)</option>
                  <option value="literary">Literary Fiction</option>
                  <option value="commercial_fiction">Commercial / Thriller / Mystery</option>
                  <option value="academic">Academic & Essayistic</option>
                </select>
              </div>

              {/* Vocabulary Level */}
              <div>
                <label htmlFor="vocab-level" className="block font-semibold text-slate-800 mb-1">
                  Vocabulary Density
                </label>
                <select
                  id="vocab-level"
                  value={formData.vocabularyLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, vocabularyLevel: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="natural">Natural & Direct (Avoid obscure words)</option>
                  <option value="moderate">Moderate & Evocative (Standard book publishing)</option>
                  <option value="advanced">Advanced & Rich (Poetic, elevated vocabulary)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Choose which types of suggestions to surface while you write.
              </p>
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  onClick={() => toggleCategory(cat.key)}
                  className="flex items-start justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-semibold text-slate-800 text-xs">{cat.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{cat.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enabledCategories[cat.key] !== false}
                    onChange={() => {}} // Handled by container onClick
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  AI Editorial Engine Provider
                </label>
                <select
                  value={formData.apiProvider}
                  onChange={(e) =>
                    setFormData({ ...formData, apiProvider: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                >
                  <option value="edge_function">
                    Supabase Serverless Edge Function (Default)
                  </option>
                  <option value="custom_llm">
                    Direct Custom LLM API (OpenAI / Anthropic / Perplexity)
                  </option>
                  <option value="mock">
                    Local Intelligence Engine Only (Offline / Zero Cost)
                  </option>
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  The local intelligence engine automatically acts as an instant fallback whenever Edge Functions or cloud connections are offline.
                </p>
              </div>

              {formData.apiProvider === 'custom_llm' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label htmlFor="custom-api-key" className="block text-xs font-semibold text-slate-700 mb-1">
                      API Key
                    </label>
                    <input
                      id="custom-api-key"
                      type="password"
                      value={formData.customApiKey || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, customApiKey: e.target.value })
                      }
                      placeholder="sk-..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-api-endpoint" className="block text-xs font-semibold text-slate-700 mb-1">
                      API Endpoint (Optional)
                    </label>
                    <input
                      id="custom-api-endpoint"
                      type="text"
                      value={formData.customApiBase || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, customApiBase: e.target.value })
                      }
                      placeholder="https://api.openai.com/v1/chat/completions"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-api-model" className="block text-xs font-semibold text-slate-700 mb-1">
                      Model Identifier (Optional)
                    </label>
                    <input
                      id="custom-api-model"
                      type="text"
                      value={formData.customModel || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, customModel: e.target.value })
                      }
                      placeholder="gpt-4o-mini"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'learning' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-800 text-xs">Continuous Adaptation</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  The editorial partner learns from suggestions you accept or dismiss. If you frequently dismiss specific categories, it automatically reduces their frequency.
                </p>
              </div>

              {/* Statistics summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-medium">Total Accepted:</span>
                  <span className="font-bold text-green-700">
                    {Object.values(learningState.acceptedCountByType).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-medium">Total Dismissed:</span>
                  <span className="font-bold text-slate-600">
                    {Object.values(learningState.dismissedCountByType).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-medium">Suppressed Categories:</span>
                  <span className="font-medium text-amber-700">
                    {learningState.suppressedTypes.length > 0
                      ? learningState.suppressedTypes.join(', ')
                      : 'None'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetLearningState}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
                >
                  Reset Learned Preferences & History
                </button>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {savedNotice ? (
              <span className="text-xs font-semibold text-green-600 animate-fade-in">
                ✓ Preferences updated!
              </span>
            ) : (
              <span></span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
