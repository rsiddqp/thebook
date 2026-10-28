import React, { useState } from 'react';
import { useBookStore } from '../store/useBookStore';
import { Suggestion, SuggestionImpact, SuggestionStatus } from '../lib/supabase';
import { EditorialSettingsModal } from './EditorialSettingsModal';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  grammar: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  articulation: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  style: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  continuity: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  pacing: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  structure: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  tone: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
};

const IMPACT_STYLES: Record<SuggestionImpact, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-800', label: 'High Impact' },
  medium: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Medium' },
  low: { bg: 'bg-slate-50', text: 'text-slate-500', label: 'Subtle' },
};

interface SuggestionSidebarProps {
  editor: any;
  onApplySuggestion: (id: string, customReplacement?: string) => void;
  onRevertSuggestion: (id: string) => void;
  onHighlightSnippet: (originalText: string) => void;
  onClearHighlight: () => void;
}

export const SuggestionSidebar: React.FC<SuggestionSidebarProps> = ({
  onApplySuggestion,
  onRevertSuggestion,
  onHighlightSnippet,
  onClearHighlight,
}) => {
  const {
    suggestions,
    dismissSuggestion,
    restoreSuggestion,
    clearResolvedSuggestions,
    isAnalyzing,
    editorialPreferences,
  } = useBookStore();

  const [activeTab, setActiveTab] = useState<SuggestionStatus>('pending');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImpact, setSelectedImpact] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Group counts
  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const acceptedCount = suggestions.filter((s) => s.status === 'accepted').length;
  const dismissedCount = suggestions.filter((s) => s.status === 'dismissed').length;
  const outdatedCount = suggestions.filter((s) => s.status === 'outdated').length;

  // Filtered suggestions for the current tab
  const filteredSuggestions = suggestions.filter((s) => {
    // Tab filter
    if (s.status !== activeTab) return false;

    // Category filter
    if (selectedCategory !== 'all' && s.type !== selectedCategory) return false;

    // Impact filter
    if (selectedImpact !== 'all' && s.impact !== selectedImpact) return false;

    return true;
  });

  const handleStartEdit = (sugg: Suggestion) => {
    setEditingId(sugg.id);
    setEditedText(sugg.suggested_text);
  };

  const handleSaveEditAndApply = (suggId: string) => {
    onApplySuggestion(suggId, editedText);
    setEditingId(null);
  };

  return (
    <div className="w-full md:w-[32%] bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-inner select-none font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Editorial Partner</h3>
            {isAnalyzing && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" title="Analyzing..." />
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {editorialPreferences.preferredTone === 'preserve'
              ? 'Voice preservation active'
              : `Tone: ${editorialPreferences.preferredTone}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Editorial Preferences & Voice Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-3 flex gap-1 text-xs shrink-0">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Pending</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              pendingCount > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('accepted')}
          className={`py-2 px-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'accepted'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Resolved</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {acceptedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dismissed')}
          className={`py-2 px-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'dismissed'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Dismissed</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {dismissedCount}
          </span>
        </button>

        {outdatedCount > 0 && (
          <button
            onClick={() => setActiveTab('outdated')}
            className={`py-2 px-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'outdated'
                ? 'border-amber-600 text-amber-800 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>Outdated</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
              {outdatedCount}
            </span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] shrink-0 gap-2">
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Types</option>
            <option value="grammar">Grammar</option>
            <option value="articulation">Articulation</option>
            <option value="style">Style</option>
            <option value="continuity">Continuity</option>
            <option value="pacing">Pacing</option>
          </select>

          <select
            value={selectedImpact}
            onChange={(e) => setSelectedImpact(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Impact</option>
            <option value="high">High Impact</option>
            <option value="medium">Medium</option>
            <option value="low">Subtle</option>
          </select>
        </div>

        {activeTab !== 'pending' && filteredSuggestions.length > 0 && (
          <button
            onClick={clearResolvedSuggestions}
            className="text-slate-400 hover:text-slate-700 transition-colors text-[10px]"
            title="Clear history"
          >
            Clear
          </button>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center rounded-full bg-slate-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <p className="text-slate-700 text-xs font-semibold">
              {activeTab === 'pending'
                ? 'Your writing is flowing cleanly'
                : activeTab === 'accepted'
                ? 'No resolved suggestions yet'
                : activeTab === 'dismissed'
                ? 'No dismissed suggestions'
                : 'No outdated suggestions'}
            </p>
            <p className="text-slate-400 text-[11px] mt-1 max-w-xs mx-auto">
              {activeTab === 'pending'
                ? 'High-impact editorial recommendations appear as you pause or conclude sentences.'
                : 'Suggestions you act upon will be preserved here.'}
            </p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => {
            const catStyle =
              CATEGORY_STYLES[suggestion.type] || CATEGORY_STYLES.style;
            const impactStyle =
              IMPACT_STYLES[suggestion.impact || 'medium'] || IMPACT_STYLES.medium;
            const isEditing = editingId === suggestion.id;

            return (
              <div
                key={suggestion.id}
                onMouseEnter={() => onHighlightSnippet(suggestion.original_text)}
                onMouseLeave={onClearHighlight}
                className={`bg-white rounded-xl border transition-all duration-200 p-3.5 space-y-2.5 shadow-sm hover:shadow ${
                  suggestion.impact === 'high' ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                {/* Badge row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {suggestion.type.toUpperCase()}
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${impactStyle.bg} ${impactStyle.text}`}
                    >
                      {impactStyle.label}
                    </span>
                  </div>

                  {suggestion.status === 'outdated' && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Modified in Editor
                    </span>
                  )}
                  {suggestion.user_edited_text && suggestion.status === 'accepted' && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Customized
                    </span>
                  )}
                </div>

                {/* Original snippet */}
                <div>
                  <div className="text-[10px] font-medium text-slate-400 mb-0.5 uppercase tracking-wider">
                    Original
                  </div>
                  <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1.5 font-serif leading-relaxed line-through decoration-slate-300">
                    "{suggestion.original_text}"
                  </div>
                </div>

                {/* Suggested replacement */}
                <div>
                  <div className="text-[10px] font-medium text-blue-600 mb-0.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Elevated Suggestion</span>
                    {activeTab === 'pending' && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(suggestion)}
                        className="text-slate-400 hover:text-slate-700 text-[10px] font-normal underline"
                      >
                        Customize
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full text-xs font-serif text-slate-900 bg-white border border-blue-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEditAndApply(suggestion.id)}
                          className="px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                        >
                          Apply Custom
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-900 bg-blue-50/70 border border-blue-100 rounded-md px-2.5 py-1.5 font-serif font-medium leading-relaxed">
                      "{suggestion.user_edited_text || suggestion.suggested_text}"
                    </div>
                  )}
                </div>

                {/* Editorial Rationale */}
                <div className="bg-slate-50/90 rounded-md px-2.5 py-1.5 border border-slate-100">
                  <p className="text-[11px] text-slate-600 leading-snug">
                    <span className="font-semibold text-slate-700">Why this works:</span>{' '}
                    {suggestion.rationale}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="pt-1 flex gap-2">
                  {suggestion.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => onApplySuggestion(suggestion.id)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors shadow-sm"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleStartEdit(suggestion)}
                        className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        title="Edit before applying"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => dismissSuggestion(suggestion.id)}
                        className="px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        title="Dismiss and suppress"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : suggestion.status === 'accepted' ? (
                    <button
                      onClick={() => onRevertSuggestion(suggestion.id)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
                    >
                      Undo & Revert Text
                    </button>
                  ) : suggestion.status === 'dismissed' ? (
                    <button
                      onClick={() => restoreSuggestion(suggestion.id)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
                    >
                      Restore to Pending
                    </button>
                  ) : (
                    <button
                      onClick={() => dismissSuggestion(suggestion.id)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
                    >
                      Dismiss Outdated
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settings Modal */}
      <EditorialSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
