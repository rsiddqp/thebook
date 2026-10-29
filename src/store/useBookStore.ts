import { create } from 'zustand';
import {
  supabase,
  Book,
  Chapter,
  Suggestion,
  EditorialPreferences,
  LearningState,
  SuggestionType,
} from '../lib/supabase';
import { User } from '@supabase/supabase-js';

const STORAGE_PREFS_KEY = 'musepad_editorial_preferences';
const STORAGE_LEARNING_KEY = 'musepad_learning_state';

const defaultPreferences: EditorialPreferences = {
  interventionLevel: 'balanced',
  preferredTone: 'preserve',
  targetAudience: 'general',
  vocabularyLevel: 'moderate',
  enabledCategories: {
    grammar: true,
    articulation: true,
    style: true,
    continuity: true,
    pacing: true,
    structure: true,
    tone: true,
  },
  apiProvider: 'edge_function',
};

const defaultLearningState: LearningState = {
  dismissedCountByType: {},
  acceptedCountByType: {},
  suppressedTypes: [],
  suppressedPhrases: [],
  dismissedHashes: {},
  acceptedHashes: {},
};

function loadStoredPreferences(): EditorialPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (raw) {
      return { ...defaultPreferences, ...JSON.parse(raw) };
    }
  } catch (e) {
    // Ignore storage errors
  }
  return defaultPreferences;
}

function loadStoredLearningState(): LearningState {
  try {
    const raw = localStorage.getItem(STORAGE_LEARNING_KEY);
    if (raw) {
      return { ...defaultLearningState, ...JSON.parse(raw) };
    }
  } catch (e) {
    // Ignore storage errors
  }
  return defaultLearningState;
}

function saveStoredPreferences(prefs: EditorialPreferences) {
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    // Ignore storage errors
  }
}

function saveStoredLearningState(learning: LearningState) {
  try {
    localStorage.setItem(STORAGE_LEARNING_KEY, JSON.stringify(learning));
  } catch (e) {
    // Ignore storage errors
  }
}

export function generateTextHash(originalText: string, context = ''): string {
  const norm = `${originalText.trim().toLowerCase()}||${context.slice(0, 50).trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

interface AnalysisContext {
  mode: 'realtime' | 'selection';
  /** The text currently being analyzed (last paragraph or selected text) */
  focusText: string;
  /** Preview label for the sidebar header */
  label: string;
}

interface BookStore {
  user: User | null;
  books: Book[];
  activeBook: Book | null;
  chapters: Chapter[];
  activeChapter: Chapter | null;
  suggestions: Suggestion[];
  loading: boolean;
  autoSaving: boolean;
  isAnalyzing: boolean;
  highlightedSuggestionId: string | null;
  editorialPreferences: EditorialPreferences;
  learningState: LearningState;
  analysisContext: AnalysisContext | null;

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
  setFocusedSuggestions: (suggestions: Suggestion[], context: AnalysisContext) => void;
  clearFocusedSuggestions: () => void;
  applySuggestion: (suggestionId: string, customText?: string) => void;
  dismissSuggestion: (suggestionId: string) => void;
  restoreSuggestion: (suggestionId: string) => void;
  recheckSuggestionsValidity: (docText: string) => void;
  clearResolvedSuggestions: () => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setHighlightedSuggestionId: (id: string | null) => void;
  setAnalysisContext: (context: AnalysisContext | null) => void;

  // Preferences & Learning actions
  updateEditorialPreferences: (prefs: Partial<EditorialPreferences>) => void;
  resetLearning: () => void;

  // Context sync
  syncChapterContext: (chapterId: string, bookId: string, content: string) => Promise<void>;
}

const MAX_PENDING_SUGGESTIONS = 20;
const MAX_TOTAL_HISTORY = 60;

export const useBookStore = create<BookStore>((set, get) => ({
  user: null,
  books: [],
  activeBook: null,
  chapters: [],
  activeChapter: null,
  suggestions: [],
  loading: false,
  autoSaving: false,
  isAnalyzing: false,
  highlightedSuggestionId: null,
  editorialPreferences: loadStoredPreferences(),
  learningState: loadStoredLearningState(),
  analysisContext: null,

  setUser: (user) => set({ user }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, books: [], activeBook: null, chapters: [], activeChapter: null, suggestions: [] });
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
    const book = get().books.find((b) => b.id === bookId);
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
    const chapter = get().chapters.find((c) => c.id === chapterId);
    if (chapter) {
      set({ activeChapter: chapter });
    }
  },

  createChapter: async (bookId, title) => {
    const { user } = get();
    if (!user) return null;

    const maxChapterNum = Math.max(...get().chapters.map((c) => c.chapter_number), 0);

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
      const chapters = get().chapters.map((c) =>
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

  setSuggestions: (incoming) => {
    const { suggestions, learningState, editorialPreferences, activeChapter } = get();

    // Check suppressed types and hashes
    const activeChapterId = activeChapter?.id;
    const now = Date.now();

    // Collect existing suggestions
    const existingMap = new Map<string, Suggestion>();
    const seenHashes = new Set<string>();

    for (const s of suggestions) {
      existingMap.set(s.id, s);
      const hash = s.text_hash || generateTextHash(s.original_text, s.context_paragraph);
      seenHashes.add(hash);
    }

    const newPending: Suggestion[] = [];

    for (const item of incoming) {
      const originalText = (item.original_text || '').trim();
      if (!originalText) continue;

      const hash = item.text_hash || generateTextHash(originalText, item.context_paragraph);

      // Check category toggle
      if (
        item.type &&
        editorialPreferences.enabledCategories &&
        editorialPreferences.enabledCategories[item.type as SuggestionType] === false
      ) {
        continue;
      }

      // Check if user has explicitly suppressed this type due to repeated dismissals
      if (learningState.suppressedTypes.includes(item.type)) {
        // If intervention level is active, still show high-impact items; otherwise skip
        if (editorialPreferences.interventionLevel !== 'active' || item.impact !== 'high') {
          continue;
        }
      }

      // If already accepted, DO NOT re-surface
      if (learningState.acceptedHashes[hash]) {
        continue;
      }

      // If dismissed recently, suppress
      if (learningState.dismissedHashes[hash]) {
        continue;
      }

      // If already present in current suggestions, avoid duplicate
      if (seenHashes.has(hash)) {
        continue;
      }

      seenHashes.add(hash);

      newPending.push({
        id: item.id || `sugg-${now}-${Math.random().toString(36).substring(2, 7)}`,
        chapter_id: activeChapterId,
        type: item.type || 'style',
        impact: item.impact || 'medium',
        original_text: item.original_text,
        suggested_text: item.suggested_text,
        rationale: item.rationale || 'Improve phrasing and rhythm',
        status: 'pending',
        context_paragraph: item.context_paragraph,
        created_at: now,
        text_hash: hash,
      });
    }

    // Merge: keep all non-pending (accepted, dismissed, outdated) and existing pending, then append new pending
    const nonPending = suggestions.filter((s) => s.status && s.status !== 'pending');
    const existingPending = suggestions.filter((s) => s.status === 'pending');

    const mergedPending = [...existingPending, ...newPending].slice(-MAX_PENDING_SUGGESTIONS);
    const combined = [...nonPending.slice(-MAX_TOTAL_HISTORY), ...mergedPending];

    set({ suggestions: combined });
  },

  setFocusedSuggestions: (incoming, context) => {
    const { learningState, editorialPreferences, activeChapter, suggestions } = get();
    const activeChapterId = activeChapter?.id;
    const now = Date.now();
    const seenHashes = new Set<string>();

    const filtered: Suggestion[] = [];

    for (const item of incoming) {
      const originalText = (item.original_text || '').trim();
      if (!originalText) continue;

      const hash = item.text_hash || generateTextHash(originalText, item.context_paragraph);

      if (
        item.type &&
        editorialPreferences.enabledCategories &&
        editorialPreferences.enabledCategories[item.type as SuggestionType] === false
      ) {
        continue;
      }

      if (learningState.suppressedTypes.includes(item.type)) {
        if (editorialPreferences.interventionLevel !== 'active' || item.impact !== 'high') {
          continue;
        }
      }

      if (learningState.acceptedHashes[hash]) continue;
      if (learningState.dismissedHashes[hash]) continue;
      if (seenHashes.has(hash)) continue;

      seenHashes.add(hash);

      filtered.push({
        id: item.id || `sugg-${now}-${Math.random().toString(36).substring(2, 7)}`,
        chapter_id: activeChapterId,
        type: item.type || 'style',
        impact: item.impact || 'medium',
        original_text: item.original_text,
        suggested_text: item.suggested_text,
        rationale: item.rationale || 'Improve phrasing and rhythm',
        status: 'pending',
        context_paragraph: item.context_paragraph,
        created_at: now,
        text_hash: hash,
      });
    }

    // Keep resolved suggestions (accepted/dismissed) but replace all pending with new focused set
    const resolved = suggestions.filter(
      (s) => s.status === 'accepted' || s.status === 'dismissed'
    );

    set({
      suggestions: [...resolved.slice(-MAX_TOTAL_HISTORY), ...filtered.slice(0, MAX_PENDING_SUGGESTIONS)],
      analysisContext: context,
    });
  },

  clearFocusedSuggestions: () => {
    const { suggestions } = get();
    // Keep only resolved history, clear pending
    const resolved = suggestions.filter(
      (s) => s.status === 'accepted' || s.status === 'dismissed'
    );
    set({ suggestions: resolved, analysisContext: null });
  },

  setAnalysisContext: (context) => set({ analysisContext: context }),

  applySuggestion: (suggestionId, customText) => {
    const { suggestions, learningState } = get();
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;

    const hash = target.text_hash || generateTextHash(target.original_text, target.context_paragraph);
    const now = Date.now();

    // Update learning state
    const currentAccepted = learningState.acceptedCountByType[target.type] || 0;
    const updatedAccepted = {
      ...learningState.acceptedCountByType,
      [target.type]: currentAccepted + 1,
    };

    const updatedAcceptedHashes = {
      ...learningState.acceptedHashes,
      [hash]: now,
    };

    // If type was previously suppressed, check if accepted helps un-suppress it
    let updatedSuppressed = [...learningState.suppressedTypes];
    const dismissCount = learningState.dismissedCountByType[target.type] || 0;
    if (currentAccepted + 1 >= dismissCount) {
      updatedSuppressed = updatedSuppressed.filter((t) => t !== target.type);
    }

    const newLearningState: LearningState = {
      ...learningState,
      acceptedCountByType: updatedAccepted,
      acceptedHashes: updatedAcceptedHashes,
      suppressedTypes: updatedSuppressed,
    };

    saveStoredLearningState(newLearningState);

    // Update suggestion status in store
    const updatedSuggestions = suggestions.map((s) => {
      if (s.id === suggestionId) {
        return {
          ...s,
          status: 'accepted' as const,
          user_edited_text: customText || s.suggested_text,
          resolved_at: now,
        };
      }
      return s;
    });

    set({
      suggestions: updatedSuggestions,
      learningState: newLearningState,
      highlightedSuggestionId: null,
    });
  },

  dismissSuggestion: (suggestionId) => {
    const { suggestions, learningState } = get();
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return;

    const hash = target.text_hash || generateTextHash(target.original_text, target.context_paragraph);
    const now = Date.now();

    const currentDismissed = (learningState.dismissedCountByType[target.type] || 0) + 1;
    const acceptCount = learningState.acceptedCountByType[target.type] || 0;

    const updatedDismissed = {
      ...learningState.dismissedCountByType,
      [target.type]: currentDismissed,
    };

    const updatedDismissedHashes = {
      ...learningState.dismissedHashes,
      [hash]: now,
    };

    // If dismissed 4 or more times and acceptance rate is low (< 25%), consider suppressing
    const updatedSuppressed = [...learningState.suppressedTypes];
    if (currentDismissed >= 4 && acceptCount / currentDismissed < 0.25) {
      if (!updatedSuppressed.includes(target.type)) {
        updatedSuppressed.push(target.type);
      }
    }

    const newLearningState: LearningState = {
      ...learningState,
      dismissedCountByType: updatedDismissed,
      dismissedHashes: updatedDismissedHashes,
      suppressedTypes: updatedSuppressed,
    };

    saveStoredLearningState(newLearningState);

    const updatedSuggestions = suggestions.map((s) => {
      if (s.id === suggestionId) {
        return {
          ...s,
          status: 'dismissed' as const,
          resolved_at: now,
        };
      }
      return s;
    });

    set({
      suggestions: updatedSuggestions,
      learningState: newLearningState,
      highlightedSuggestionId: null,
    });
  },

  restoreSuggestion: (suggestionId) => {
    const { suggestions } = get();
    const updated = suggestions.map((s) => {
      if (s.id === suggestionId) {
        return {
          ...s,
          status: 'pending' as const,
          resolved_at: undefined,
        };
      }
      return s;
    });
    set({ suggestions: updated });
  },

  recheckSuggestionsValidity: (docText: string) => {
    const { suggestions } = get();
    let hasChanges = false;

    const updated = suggestions.map((s) => {
      if (s.status === 'pending') {
        const originalExists = docText.includes(s.original_text);
        if (!originalExists) {
          hasChanges = true;
          // Check if author manually wrote the suggested text
          const suggestedExists = docText.includes(s.suggested_text);
          return {
            ...s,
            status: suggestedExists ? ('accepted' as const) : ('outdated' as const),
            resolved_at: Date.now(),
          };
        }
      } else if (s.status === 'outdated') {
        // If the original text is back, make it pending again
        if (docText.includes(s.original_text)) {
          hasChanges = true;
          return {
            ...s,
            status: 'pending' as const,
            resolved_at: undefined,
          };
        }
      }
      return s;
    });

    if (hasChanges) {
      set({ suggestions: updated });
    }
  },

  clearResolvedSuggestions: () => {
    const { suggestions } = get();
    set({ suggestions: suggestions.filter((s) => s.status === 'pending') });
  },

  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setHighlightedSuggestionId: (id) => set({ highlightedSuggestionId: id }),

  updateEditorialPreferences: (prefs) => {
    const current = get().editorialPreferences;
    const updated = {
      ...current,
      ...prefs,
      enabledCategories: {
        ...current.enabledCategories,
        ...(prefs.enabledCategories || {}),
      },
    };
    saveStoredPreferences(updated);
    set({ editorialPreferences: updated });
  },

  resetLearning: () => {
    saveStoredLearningState(defaultLearningState);
    set({ learningState: defaultLearningState });
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
          chapterContent: content,
        },
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
              style_fingerprint: data.styleFingerprint,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error syncing context:', error);
    }
  },
}));
