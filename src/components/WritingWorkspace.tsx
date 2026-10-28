import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useBookStore } from '../store/useBookStore';
import { ChapterBar } from './ChapterBar';
import { SuggestionSidebar } from './SuggestionSidebar';
import { executeEditorialAnalysis } from '../utils/editorialEngine';
import { findTextRangeInDoc } from '../utils/editorUtils';

export const WritingWorkspace: React.FC = () => {
  const {
    activeBook,
    activeChapter,
    suggestions,
    editorialPreferences,
    learningState,
    updateChapterContent,
    setSuggestions,
    applySuggestion,
    restoreSuggestion,
    recheckSuggestionsValidity,
    setIsAnalyzing,
    isAnalyzing,
  } = useBookStore();

  const debounceTimerRef = useRef<number | null>(null);
  const lastAnalyzedTextRef = useRef<string>('');
  const analysisInProgressRef = useRef<boolean>(false);
  const previousSelectionPosRef = useRef<number>(0);

  const analyzeWriting = useCallback(
    async (fullText: string) => {
      if (!activeChapter || !activeBook || analysisInProgressRef.current) return;
      if (fullText.trim().length < 30) return;

      // Avoid re-analyzing identical text
      if (fullText.trim() === lastAnalyzedTextRef.current.trim()) {
        return;
      }

      analysisInProgressRef.current = true;
      setIsAnalyzing(true);

      try {
        const result = await executeEditorialAnalysis({
          fullText,
          activeChapterId: activeChapter.id,
          bookTitle: activeBook.title,
          bookGenre: activeBook.genre,
          styleFingerprint: activeBook.style_fingerprint || {},
          globalContextSummary: activeBook.global_context_summary || '',
          preferences: editorialPreferences,
          learningState,
        });

        lastAnalyzedTextRef.current = fullText.trim();

        if (result?.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
        }
      } catch (error) {
        console.error('Error in editorial analysis:', error);
      } finally {
        analysisInProgressRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      activeChapter,
      activeBook,
      editorialPreferences,
      learningState,
      setSuggestions,
      setIsAnalyzing,
    ]
  );

  const handleContentChange = useCallback(
    (html: string, plainText: string) => {
      if (!activeChapter || !activeBook) return;

      updateChapterContent(activeChapter.id, html);

      // Dynamically validate existing suggestions against modified content
      recheckSuggestionsValidity(plainText);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Smart debounce: shorter pause (1.2s) if punctuation / sentence completion or newline,
      // otherwise 2.2s of inactive typing to minimize interruptions
      const trimmed = plainText.trim();
      const lastChar = trimmed.slice(-1);
      const isSentenceEnd = ['.', '?', '!', '\n'].includes(lastChar);
      const delay = isSentenceEnd ? 1200 : 2200;

      debounceTimerRef.current = window.setTimeout(() => {
        analyzeWriting(plainText);
      }, delay);
    },
    [activeChapter, activeBook, updateChapterContent, recheckSuggestionsValidity, analyzeWriting]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Begin writing your story here...',
      }),
    ],
    content: activeChapter?.content || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-none font-serif text-lg leading-relaxed min-h-[500px]',
      },
    },
    onUpdate: ({ editor: ed }: any) => {
      const html = ed.getHTML();
      const plainText = ed.getText({ blockSeparator: '\n\n' });
      previousSelectionPosRef.current = ed.state.selection.from;
      handleContentChange(html, plainText);
    },
    onSelectionUpdate: ({ editor: ed }: any) => {
      previousSelectionPosRef.current = ed.state.selection.from;
    },
  });

  // Sync content when active chapter changes
  useEffect(() => {
    if (editor && activeChapter) {
      const currentContent = editor.getHTML();
      if (currentContent !== activeChapter.content) {
        editor.commands.setContent(activeChapter.content || '');
      }
    }
  }, [activeChapter, editor]);

  // Reset analysis cache on chapter change
  useEffect(() => {
    lastAnalyzedTextRef.current = '';
  }, [activeChapter?.id]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Applies a suggestion accurately without disrupting user's cursor position or writing flow.
   */
  const handleApplySuggestion = useCallback(
    (suggestionId: string, customReplacement?: string) => {
      if (!editor) return;

      const suggestion = suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;

      const textToInsert =
        customReplacement !== undefined ? customReplacement : suggestion.suggested_text;
      const originalText = suggestion.original_text;

      // 1. Capture current cursor / selection
      const currentSelection = editor.state.selection;
      const currentCursor = currentSelection.from;

      // 2. Locate exact range in document
      const range = findTextRangeInDoc(editor.state.doc, originalText, currentCursor);
      if (!range) {
        // Text may have already been edited or replaced
        applySuggestion(suggestionId, textToInsert);
        return;
      }

      // 3. Compute preserved cursor offset
      const deltaLength = textToInsert.length - originalText.length;
      let newCursor = currentCursor;
      if (currentCursor >= range.to) {
        newCursor = currentCursor + deltaLength;
      } else if (currentCursor >= range.from && currentCursor < range.to) {
        newCursor = range.from + textToInsert.length;
      }

      // 4. Replace content precisely
      editor
        .chain()
        .focus()
        .setTextSelection({ from: range.from, to: range.to })
        .insertContent(textToInsert)
        .run();

      // 5. Restore cursor position seamlessly
      try {
        const docSize = editor.state.doc.content.size;
        const clampedPos = Math.max(0, Math.min(newCursor, docSize));
        editor.commands.setTextSelection(clampedPos);
      } catch (err) {
        // Fallback
      }

      // 6. Update store
      applySuggestion(suggestionId, textToInsert);
    },
    [editor, suggestions, applySuggestion]
  );

  /**
   * Reverts an accepted suggestion back to the original text.
   */
  const handleRevertSuggestion = useCallback(
    (suggestionId: string) => {
      if (!editor) return;

      const suggestion = suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;

      const currentAppliedText = suggestion.user_edited_text || suggestion.suggested_text;
      const originalText = suggestion.original_text;

      const range = findTextRangeInDoc(editor.state.doc, currentAppliedText);
      if (range) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: range.from, to: range.to })
          .insertContent(originalText)
          .run();
      }

      restoreSuggestion(suggestionId);
    },
    [editor, suggestions, restoreSuggestion]
  );

  /**
   * Highlights the target text snippet in the TipTap editor when hovering or focusing a card.
   */
  const handleHighlightSnippet = useCallback(
    (originalText: string) => {
      if (!editor || !originalText) return;
      const range = findTextRangeInDoc(
        editor.state.doc,
        originalText,
        previousSelectionPosRef.current
      );
      if (range) {
        editor
          .chain()
          .setTextSelection({ from: range.from, to: range.to })
          .scrollIntoView()
          .run();
      }
    },
    [editor]
  );

  const handleClearHighlight = useCallback(() => {
    if (!editor) return;
    const pos = previousSelectionPosRef.current || editor.state.doc.content.size;
    editor.commands.setTextSelection(pos);
  }, [editor]);

  if (!activeBook || !activeChapter) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <ChapterBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Writing Canvas (70% width) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 min-h-[650px] relative transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 text-xs text-slate-400 font-sans">
                <span className="font-medium tracking-wide uppercase text-slate-500">
                  {activeBook.title} — Chapter {activeChapter.chapter_number}
                </span>
                <div className="flex items-center gap-3">
                  {isAnalyzing && (
                    <span className="flex items-center gap-1.5 text-blue-600 animate-pulse font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                      Editorial analysis in progress...
                    </span>
                  )}
                  <span>
                    {editor ? editor.getText().split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                </div>
              </div>

              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Suggestion Sidebar (30% width) */}
        <SuggestionSidebar
          editor={editor}
          onApplySuggestion={handleApplySuggestion}
          onRevertSuggestion={handleRevertSuggestion}
          onHighlightSnippet={handleHighlightSnippet}
          onClearHighlight={handleClearHighlight}
        />
      </div>
    </div>
  );
};
