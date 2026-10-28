import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useBookStore } from '../store/useBookStore';
import { ChapterBar } from './ChapterBar';
import { SuggestionSidebar } from './SuggestionSidebar';
import { supabase } from '../lib/supabase';

export const WritingWorkspace: React.FC = () => {
  const {
    activeBook,
    activeChapter,
    updateChapterContent,
    setSuggestions,
    syncChapterContext,
  } = useBookStore();

  const debounceTimerRef = useRef<number | null>(null);
  const lastContentRef = useRef<string>('');
  const lastAnalyzedParagraphsRef = useRef<string>('');
  const analysisInProgressRef = useRef<boolean>(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Begin writing your story...',
      }),
    ],
    content: activeChapter?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none font-serif text-lg leading-relaxed',
      },
    },
    onUpdate: ({ editor }: any) => {
      const html = editor.getHTML();
      handleContentChange(html);
    },
  });

  // Update editor content when active chapter changes
  useEffect(() => {
    if (editor && activeChapter) {
      const currentContent = editor.getHTML();
      if (currentContent !== activeChapter.content) {
        editor.commands.setContent(activeChapter.content);
        lastContentRef.current = activeChapter.content;
      }
    }
  }, [activeChapter?.id]);

  const handleContentChange = useCallback((html: string) => {
    if (!activeChapter || !activeBook) return;

    // Auto-save to database
    updateChapterContent(activeChapter.id, html);

    // Debounced AI analysis
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      analyzeWriting(html);
    }, 2500);
  }, [activeChapter?.id, activeBook?.id]);

  const analyzeWriting = async (html: string) => {
    if (!activeChapter || !activeBook || analysisInProgressRef.current) return;

    // Extract text content from HTML
    const text = html.replace(/<[^>]*>/g, '').trim();
    
    // Only analyze if there's meaningful content
    if (text.length < 50) {
      setSuggestions([]);
      return;
    }

    // Don't re-analyze if content hasn't changed significantly
    if (text === lastContentRef.current) return;
    lastContentRef.current = text;

    analysisInProgressRef.current = true;

    try {
      // Split into paragraphs
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      
      // Keep only the last two paragraphs as the analysis window
      const activeText = paragraphs.slice(-2).join('\n\n');
      
      // Skip re-analysis if the last two paragraphs haven't changed
      if (activeText === lastAnalyzedParagraphsRef.current) {
        analysisInProgressRef.current = false;
        return;
      }
      lastAnalyzedParagraphsRef.current = activeText;
      
      // No older context—suggestions are limited to the latest two paragraphs
      const localContext = '';

      const { data, error } = await supabase.functions.invoke('analyze-writing', {
        body: {
          activeText,
          localContext,
          styleFingerprint: activeBook.style_fingerprint || {},
          globalContext: activeBook.global_context_summary || '',
        },
      });

      if (error) console.error('analyze-writing error:', error);
      if (!error && data?.suggestions) {
        setSuggestions(data.suggestions);
      } else if (data?.error) {
        console.error('analyze-writing returned error:', data.error);
      }
    } catch (error) {
      console.error('Error analyzing writing:', error);
    } finally {
      analysisInProgressRef.current = false;
    }
  };

  // Sync chapter context when switching chapters
  useEffect(() => {
    if (activeChapter && activeBook && activeChapter.content) {
      const syncTimer = setTimeout(() => {
        const text = activeChapter.content.replace(/<[^>]*>/g, '').trim();
        if (text.length > 200) {
          syncChapterContext(activeChapter.id, activeBook.id, text);
        }
      }, 5000);

      return () => clearTimeout(syncTimer);
    }
  }, [activeChapter?.id]);

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
        {/* Writing Board */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 min-h-[600px]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Suggestion Sidebar */}
        <SuggestionSidebar editor={editor} />
      </div>
    </div>
  );
};
