import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface Suggestion {
  id: string;
  type: 'articulation' | 'grammar' | 'style' | 'continuity';
  original_text: string;
  suggested_text: string;
  rationale: string;
}
