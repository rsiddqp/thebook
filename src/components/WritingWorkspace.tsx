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
    setFocusedSuggestions,
    clearFocusedSuggestions,
    applySuggestion,
    restoreSuggestion,
    recheckSuggestionsValidity,
    setIsAnalyzing,
    isAnalyzing,
  } = useBookStore();

  const debounceTimerRef = useRef<number | null>(null);
  const selectionTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<{ id: string; html: string } | null>(null);
  const lastAnalyzedTextRef = useRef<string>('');
  const lastAnalyzedModeRef = useRef<'realtime' | 'selection' | ''>('');
  const analysisInProgressRef = useRef<boolean>(false);
  const previousSelectionPosRef = useRef<number>(0);
  const loadedChapterIdRef = useRef<string | null>(null);
  const currentSelectionTextRef = useRef<string>('');

  const activeChapterId = activeChapter?.id;

  /**
   * Analyzes writing:
   * - If selectedText is provided (>= 10 chars), analyzes only that selection in "selection/editorial" mode.
   * - Otherwise, analyzes the last paragraph in "realtime co-writer" mode.
   */
  const analyzeWriting = useCallback(
    async (fullText: string, selectedText?: string) => {
      if (!activeChapterId || !activeBook || analysisInProgressRef.current) return;

      const isSelectionMode = Boolean(selectedText && selectedText.trim().length >= 10);
      const textToAnalyze = isSelectionMode ? selectedText!.trim() : fullText.trim();

      if (textToAnalyze.length < 15) {
        if (!isSelectionMode) {
          clearFocusedSuggestions();
        }
        return;
      }

      // Avoid re-analyzing identical focus area in the same mode
      const modeKey = isSelectionMode ? 'selection' : 'realtime';
      if (
        textToAnalyze === lastAnalyzedTextRef.current.trim() &&
        lastAnalyzedModeRef.current === modeKey
      ) {
        return;
      }

      analysisInProgressRef.current = true;
      setIsAnalyzing(true);

      try {
        const result = await executeEditorialAnalysis({
          fullText,
          selectedText: isSelectionMode ? selectedText : undefined,
          activeChapterId,
          bookTitle: activeBook.title,
          bookGenre: activeBook.genre,
          styleFingerprint: activeBook.style_fingerprint || {},
          globalContextSummary: activeBook.global_context_summary || '',
          preferences: editorialPreferences,
          learningState,
        });

        lastAnalyzedTextRef.current = textToAnalyze;
        lastAnalyzedModeRef.current = modeKey;

        const previewSnippet =
          result.focusText.length > 60
            ? `${result.focusText.slice(0, 60)}...`
            : result.focusText;

        const context = {
          mode: modeKey as 'realtime' | 'selection',
          focusText: result.focusText,
          label: isSelectionMode
            ? `Selected Text: "${previewSnippet}"`
            : `Current Paragraph: "${previewSnippet}"`,
        };

        if (result?.suggestions && result.suggestions.length > 0) {
          setFocusedSuggestions(result.suggestions, context);
        } else {
          // If no suggestions generated for this focus, clear pending but record context
          setFocusedSuggestions([], context);
        }
      } catch (error) {
        console.error('Error in editorial analysis:', error);
      } finally {
        analysisInProgressRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      activeChapterId,
      activeBook,
      editorialPreferences,
      learningState,
      setFocusedSuggestions,
      clearFocusedSuggestions,
      setIsAnalyzing,
    ]
  );

  const handleContentChange = useCallback(
    (html: string, plainText: string) => {
      if (!activeChapterId) return;

      // Queue debounced auto-save
      pendingContentRef.current = { id: activeChapterId, html };
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = window.setTimeout(() => {
        if (pendingContentRef.current) {
          updateChapterContent(pendingContentRef.current.id, pendingContentRef.current.html);
          pendingContentRef.current = null;
        }
      }, 1500);

      // If user has an active text selection, do not trigger realtime typing debounce
      if (currentSelectionTextRef.current.length >= 10) return;

      // Debounce suggestions analysis for active/last paragraph typing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Shorter pause (1.0s) if sentence ended or newline; 2.0s during continuous typing
      const trimmed = plainText.trim();
      const lastChar = trimmed.slice(-1);
      const isSentenceEnd = ['.', '?', '!', '\n'].includes(lastChar);
      const delay = isSentenceEnd ? 1000 : 2000;

      debounceTimerRef.current = window.setTimeout(() => {
        recheckSuggestionsValidity(plainText);
        analyzeWriting(plainText);
      }, delay);
    },
    [activeChapterId, updateChapterContent, recheckSuggestionsValidity, analyzeWriting]
  );

  const handleSelectionChange = useCallback(
    (selectedText: string, fullText: string) => {
      currentSelectionTextRef.current = selectedText;

      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
      }

      if (selectedText.length >= 10) {
        // User highlighted a sentence or paragraph -> editorial review mode
        selectionTimerRef.current = window.setTimeout(() => {
          analyzeWriting(fullText, selectedText);
        }, 600);
      } else {
        // Selection cleared -> return focus to real-time writing on last paragraph
        if (lastAnalyzedModeRef.current === 'selection') {
          selectionTimerRef.current = window.setTimeout(() => {
            analyzeWriting(fullText);
          }, 400);
        }
      }
    },
    [analyzeWriting]
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
      const { from, to } = ed.state.selection;
      previousSelectionPosRef.current = from;

      if (from !== to) {
        const selectedText = ed.state.doc.textBetween(from, to, ' ');
        const fullText = ed.getText({ blockSeparator: '\n\n' });
        handleSelectionChange(selectedText.trim(), fullText);
      } else {
        const fullText = ed.getText({ blockSeparator: '\n\n' });
        handleSelectionChange('', fullText);
      }
    },
  });

  // Sync content ONLY when active chapter ID changes (initial load or user switches chapter)
  useEffect(() => {
    if (!editor || !activeChapterId) return;

    if (loadedChapterIdRef.current !== activeChapterId) {
      if (pendingContentRef.current && pendingContentRef.current.id !== activeChapterId) {
        updateChapterContent(pendingContentRef.current.id, pendingContentRef.current.html);
        pendingContentRef.current = null;
      }

      loadedChapterIdRef.current = activeChapterId;
      const chapterContent = activeChapter?.content || '';
      editor.commands.setContent(chapterContent);
      lastAnalyzedTextRef.current = '';
      lastAnalyzedModeRef.current = '';
    }
  }, [activeChapterId, activeChapter?.content, editor, updateChapterContent]);

  // Flush pending auto-save and clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      if (pendingContentRef.current) {
        updateChapterContent(pendingContentRef.current.id, pendingContentRef.current.html);
      }
    };
  }, [updateChapterContent]);

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

      // 2. Locate text range in document (with fuzzy matching support)
      const range = findTextRangeInDoc(editor.state.doc, originalText, currentCursor);
      
      if (!range) {
        // Text not found - mark as outdated and trigger recheck
        console.warn(`Cannot apply suggestion ${suggestionId}: original text not found in document`);
        const fullDocText = editor.getText({ blockSeparator: '\n\n' });
        recheckSuggestionsValidity(fullDocText);
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
      const replaceSuccess = editor
        .chain()
        .focus()
        .setTextSelection({ from: range.from, to: range.to })
        .insertContent(textToInsert)
        .run();

      // 5. Verify the replacement succeeded
      if (!replaceSuccess) {
        console.error(`Failed to apply suggestion ${suggestionId}: editor command failed`);
        return;
      }

      // 6. Restore cursor position seamlessly
      try {
        const docSize = editor.state.doc.content.size;
        const clampedPos = Math.max(0, Math.min(newCursor, docSize));
        editor.commands.setTextSelection(clampedPos);
      } catch (err) {
        // Fallback - don't fail the entire operation if cursor positioning fails
        console.warn('Failed to restore cursor position:', err);
      }

      // 7. Update store after successful replacement
      applySuggestion(suggestionId, textToInsert);

      // 8. Recheck validity of remaining suggestions
      const updatedText = editor.getText({ blockSeparator: '\n\n' });
      recheckSuggestionsValidity(updatedText);
    },
    [editor, suggestions, applySuggestion, recheckSuggestionsValidity]
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
   * Highlights the target text snippet in the TipTap editor without interrupting active typing.
   */
  const handleHighlightSnippet = useCallback(
    (originalText: string) => {
      if (!editor || !originalText) return;
      // Do not interrupt if user is currently focused and typing in editor
      if (editor.isFocused) return;

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
    // Intentionally no-op to avoid jumping selection on mouse leave
  }, []);

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
