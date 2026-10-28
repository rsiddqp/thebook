import { create } from 'zustand';
import { supabase, Book, Chapter, Suggestion } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface BookStore {
  user: User | null;
  books: Book[];
  activeBook: Book | null;
  chapters: Chapter[];
  activeChapter: Chapter | null;
  suggestions: Suggestion[];
  loading: boolean;
  autoSaving: boolean;
  
  // Auth actions
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  
  // Book actions
  fetchBooks: () => Promise<void>;
  createBook: (title: string, genre?: string) => Promise<Book | null>;
  setActiveBook: (bookId: string) => Promise<void>;
  
  // Chapter actions
  fetchChapters: (bookId: string) => Promise<void>;
  setActiveChapter: (chapterId: string) => void;
  createChapter: (bookId: string, title: string) => Promise<Chapter | null>;
  updateChapterContent: (chapterId: string, content: string) => Promise<void>;
  
  // Suggestion actions
  setSuggestions: (suggestions: Suggestion[]) => void;
  applySuggestion: (suggestionId: string) => void;
  dismissSuggestion: (suggestionId: string) => void;
  
  // Context sync
  syncChapterContext: (chapterId: string, bookId: string, content: string) => Promise<void>;
}

export const useBookStore = create<BookStore>((set, get) => ({
  user: null,
  books: [],
  activeBook: null,
  chapters: [],
  activeChapter: null,
  suggestions: [],
  loading: false,
  autoSaving: false,

  setUser: (user) => set({ user }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, books: [], activeBook: null, chapters: [], activeChapter: null });
  },

  fetchBooks: async () => {
    const { user } = get();
    if (!user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ books: data });
    }
    set({ loading: false });
  },

  createBook: async (title, genre) => {
    const { user } = get();
    if (!user) return null;

    const { data: book, error } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title,
        genre: genre || null,
        style_fingerprint: {},
      })
      .select()
      .single();

    if (error || !book) {
      console.error('Error creating book:', error);
      return null;
    }

    // Create first chapter
    const { data: chapter } = await supabase
      .from('chapters')
      .insert({
        book_id: book.id,
        user_id: user.id,
        chapter_number: 1,
        title: 'Chapter 1',
        content: '',
      })
      .select()
      .single();

    set({ books: [...get().books, book], activeBook: book });
    if (chapter) {
      set({ chapters: [chapter], activeChapter: chapter });
    }

    return book;
  },

  setActiveBook: async (bookId) => {
    const book = get().books.find(b => b.id === bookId);
    if (!book) return;

    set({ activeBook: book });
    await get().fetchChapters(bookId);
  },

  fetchChapters: async (bookId) => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true });

    if (!error && data) {
      set({ chapters: data });
      if (data.length > 0 && !get().activeChapter) {
        set({ activeChapter: data[0] });
      }
    }
  },

  setActiveChapter: (chapterId) => {
    const chapter = get().chapters.find(c => c.id === chapterId);
    if (chapter) {
      set({ activeChapter: chapter, suggestions: [] });
    }
  },

  createChapter: async (bookId, title) => {
    const { user } = get();
    if (!user) return null;

    const maxChapterNum = Math.max(...get().chapters.map(c => c.chapter_number), 0);

    const { data, error } = await supabase
      .from('chapters')
      .insert({
        book_id: bookId,
        user_id: user.id,
        chapter_number: maxChapterNum + 1,
        title,
        content: '',
      })
      .select()
      .single();

    if (!error && data) {
      set({ chapters: [...get().chapters, data], activeChapter: data });
      return data;
    }

    return null;
  },

  updateChapterContent: async (chapterId, content) => {
    set({ autoSaving: true });

    const { error } = await supabase
      .from('chapters')
      .update({ content })
      .eq('id', chapterId);

    if (!error) {
      const chapters = get().chapters.map(c =>
        c.id === chapterId ? { ...c, content } : c
      );
      const activeChapter = get().activeChapter;
      if (activeChapter?.id === chapterId) {
        set({ activeChapter: { ...activeChapter, content } });
      }
      set({ chapters });
    }

    set({ autoSaving: false });
  },

  setSuggestions: (suggestions) => set({ suggestions }),

  applySuggestion: (suggestionId) => {
    set({
      suggestions: get().suggestions.filter(s => s.id !== suggestionId)
    });
  },

  dismissSuggestion: (suggestionId) => {
    set({
      suggestions: get().suggestions.filter(s => s.id !== suggestionId)
    });
  },

  syncChapterContext: async (chapterId, bookId, content) => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('sync-chapter-context', {
        body: {
          chapterId,
          bookId,
          userId: user.id,
          chapterContent: content
        }
      });

      if (error) console.error('sync-chapter-context error:', error);
      if (!error && data?.success) {
        // Update active book with new context
        const activeBook = get().activeBook;
        if (activeBook && activeBook.id === bookId) {
          set({
            activeBook: {
              ...activeBook,
              global_context_summary: data.globalContext,
              style_fingerprint: data.styleFingerprint
            }
          });
        }
      }
    } catch (error) {
      console.error('Error syncing context:', error);
    }
  },
}));
