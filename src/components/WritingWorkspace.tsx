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
  } = useBookStore();

  const debounceTimerRef = useRef<number | null>(null);
  const lastAnalyzedParagraphsRef = useRef<string>('');
  const analysisInProgressRef = useRef<boolean>(false);

  const MAX_RETRIES = 3;

  const invokeWithRetry = useCallback(async (body: any, attempt = 0): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-writing', { body });
      if (!error) return data;
    } catch (invokeError) {
      // functions-js may throw FunctionsHttpError on non-2xx; treat as retryable
    }

    if (attempt < MAX_RETRIES) {
      const backoff = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoff));
      return invokeWithRetry(body, attempt + 1);
    }

    return { error: new Error('analyze-writing failed after retries') };
  }, []);

  const analyzeWriting = useCallback(async (html: string) => {
    if (!activeChapter || !activeBook || analysisInProgressRef.current) return;

    const text = html.replace(/<[^>]*>/g, '').trim();

    if (text.length < 50) return;

    analysisInProgressRef.current = true;

    try {
      const paragraphs = text.split('\n\n').filter(p => p.trim());

      const activeText = paragraphs.slice(-2).join('\n\n');

      if (activeText === lastAnalyzedParagraphsRef.current) {
        analysisInProgressRef.current = false;
        return;
      }
      lastAnalyzedParagraphsRef.current = activeText;

      const localContext = '';

      const result = await invokeWithRetry({
        activeText,
        localContext,
        styleFingerprint: activeBook.style_fingerprint || {},
        globalContext: activeBook.global_context_summary || '',
      });

      if (result?.error) {
        console.error('analyze-writing error after retries:', result.error);
        return;
      }

      if (result?.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
    } catch (error) {
      console.error('Error analyzing writing:', error);
    } finally {
      analysisInProgressRef.current = false;
    }
  }, [activeChapter, activeBook, activeBook?.style_fingerprint, activeBook?.global_context_summary, setSuggestions, invokeWithRetry]);

  const handleContentChange = useCallback((html: string) => {
    if (!activeChapter || !activeBook) return;

    updateChapterContent(activeChapter.id, html);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      analyzeWriting(html);
    }, 2500);
  }, [activeChapter?.id, activeBook?.id, analyzeWriting]);

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

  useEffect(() => {
    if (editor && activeChapter) {
      const currentContent = editor.getHTML();
      if (currentContent !== activeChapter.content) {
        editor.commands.setContent(activeChapter.content);
      }
    }
  }, [activeChapter?.id, editor]);

  useEffect(() => {
    lastAnalyzedParagraphsRef.current = '';
  }, [activeChapter?.id]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 min-h-[600px]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <SuggestionSidebar editor={editor} />
      </div>
    </div>
  );
};
