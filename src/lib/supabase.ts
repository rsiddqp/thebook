import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export interface Book {
  id: string;
  user_id: string;
  title: string;
  genre: string | null;
  style_fingerprint: Record<string, any>;
  global_context_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  user_id: string;
  chapter_number: number;
  title: string;
  content: string;
  chapter_summary: string | null;
  created_at: string;
  updated_at: string;
}

export type SuggestionType =
  | 'articulation'
  | 'grammar'
  | 'style'
  | 'continuity'
  | 'pacing'
  | 'structure'
  | 'tone';

export type SuggestionImpact = 'high' | 'medium' | 'low';

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'outdated' | 'ignored';

export interface Suggestion {
  id: string;
  chapter_id?: string;
  type: SuggestionType;
  impact?: SuggestionImpact;
  original_text: string;
  suggested_text: string;
  user_edited_text?: string;
  rationale: string;
  status?: SuggestionStatus;
  context_paragraph?: string;
  created_at?: number;
  resolved_at?: number;
  text_hash?: string;
}

export interface EditorialPreferences {
  interventionLevel: 'minimal' | 'balanced' | 'active';
  preferredTone: 'preserve' | 'literary' | 'minimalist' | 'conversational' | 'formal';
  targetAudience: 'general' | 'young_adult' | 'literary' | 'commercial_fiction' | 'academic';
  vocabularyLevel: 'natural' | 'moderate' | 'advanced';
  enabledCategories: Record<SuggestionType, boolean>;
  apiProvider: 'edge_function' | 'custom_llm' | 'mock';
  customApiKey?: string;
  customApiBase?: string;
  customModel?: string;
}

export interface LearningState {
  dismissedCountByType: Record<string, number>;
  acceptedCountByType: Record<string, number>;
  suppressedTypes: string[];
  suppressedPhrases: string[];
  dismissedHashes: Record<string, number>;
  acceptedHashes: Record<string, number>;
}
