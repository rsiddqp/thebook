import React from 'react';
import { useBookStore } from '../store/useBookStore';

const CATEGORY_COLORS = {
  articulation: 'bg-blue-100 text-blue-800 border-blue-200',
  grammar: 'bg-red-100 text-red-800 border-red-200',
  style: 'bg-purple-100 text-purple-800 border-purple-200',
  continuity: 'bg-amber-100 text-amber-800 border-amber-200',
};

interface SuggestionSidebarProps {
  editor: any;
}

export const SuggestionSidebar: React.FC<SuggestionSidebarProps> = ({ editor }) => {
  const { suggestions, applySuggestion, dismissSuggestion } = useBookStore();

  const handleApply = (suggestionId: string, originalText: string, suggestedText: string) => {
    if (!editor) return;

    // Find and replace the original text in the editor
    const { state } = editor;
    const { doc } = state;
    let found = false;

    doc.descendants((node: any, pos: number) => {
      if (found) return false;

      if (node.isText && node.text) {
        const index = node.text.indexOf(originalText);
        if (index !== -1) {
          const from = pos + index;
          const to = from + originalText.length;
          
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .insertContent(suggestedText)
            .run();
          
          found = true;
          return false;
        }
      }
    });

    applySuggestion(suggestionId);
  };

  const handleDismiss = (suggestionId: string) => {
    dismissSuggestion(suggestionId);
  };

  return (
    <div className="w-full md:w-[30%] bg-slate-50 border-l border-slate-200 overflow-y-auto">
      <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-4 py-3 z-10">
        <h3 className="text-lg font-semibold text-slate-900">Suggestions</h3>
        <p className="text-xs text-slate-500 mt-1">
          {suggestions.length === 0
            ? 'Keep writing to get suggestions'
            : `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {suggestions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg
              className="w-16 h-16 mx-auto text-slate-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-slate-600 text-sm">
              AI suggestions will appear here as you write
            </p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3"
            >
              <div>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
                    CATEGORY_COLORS[suggestion.type]
                  }`}
                >
                  {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Original:</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded px-2 py-1.5 font-serif">
                  "{suggestion.original_text}"
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Suggested:</p>
                <p className="text-sm text-slate-900 bg-blue-50 rounded px-2 py-1.5 font-serif">
                  "{suggestion.suggested_text}"
                </p>
              </div>

              <div className="bg-slate-50 rounded px-3 py-2">
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Why this works:</span> {suggestion.rationale}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() =>
                    handleApply(suggestion.id, suggestion.original_text, suggestion.suggested_text)
                  }
                  className="flex-1 bg-slate-900 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
