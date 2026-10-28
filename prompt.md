# Project Specification: Suggestive AI Book-Writing Companion ("MusePad")

## 1. Role & Objective
Act as a Principal Full-Stack Architect and Product Designer. Build a complete, production-ready, minimalist web application designed for aspiring book authors. The platform acts as a real-time editorial companion—NOT a ghostwriter. It observes the user's writing in real time and provides phrasing, articulation, grammar, and structural suggestions in a right-hand sidebar while strictly preserving the author's unique voice, tone, and narrative continuity across chapters.

## 2. Hosting & Tech Stack Constraints
The app must be optimized for static frontend hosting (GitHub Pages / Vercel) paired with a serverless backend:
- **Frontend Framework:** React 18+ (Vite) with TypeScript.
- **Styling:** Tailwind CSS (clean, distraction-free editorial aesthetic, soft off-white/slate palette, crisp typography like Inter for UI and Merriweather/Lora for the writing board).
- **State Management:** Zustand (for active book, active chapter, editor state, and live suggestions).
- **Text Editor:** TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`) for clean rich-text editing and easy paragraph/sentence node extraction.
- **Backend / Auth / DB:** Supabase (`@supabase/supabase-js`) for Authentication, PostgreSQL Database, and Supabase Edge Functions (to securely call the LLM API without exposing keys on the client).
- **LLM Structured Outputs:** OpenAI API (`gpt-4o` or `gpt-4o-mini`) or Anthropic API via Supabase Edge Functions, returning strict JSON schemas.

---

## 3. UI/UX Layout (Strictly Follow Wireframe)
Once authenticated and inside a book project, the main workspace must feature a distraction-free, two-column split layout:
1. **Top Navigation / Chapter Bar (Left-Aligned above Writing Board):**
   - Displays current book title and a clean horizontal selector/dropdown for chapters (e.g., `Chapter - 1: [Editable Title]`, `+ New Chapter` button, and an auto-save status indicator).
2. **Main Writing Board (Left/Center - 70% width):**
   - Large, rounded rectangular container (`rounded-2xl border bg-white shadow-sm p-8`).
   - Distraction-free TipTap canvas where the author writes prose.
   - Clicking a suggestion card on the right highlights the corresponding sentence/paragraph in the editor.
3. **Suggestion Panel (Right Sidebar - 30% width, full height):**
   - Vertical container (`border-l or rounded-xl border bg-slate-50 p-4`) labeled "Suggestions".
   - Displays real-time, non-intrusive editorial cards as the user pauses typing.
   - Each card shows:
     - **Category Badge:** `Articulation`, `Grammar`, `Pacing`, or `Continuity`.
     - **Original Snippet:** The exact phrase from the writing board.
     - **Suggested Improvement:** 1–2 elevated alternatives that preserve the user's voice.
     - **Why this works:** A 1-sentence editorial explanation.
     - **Actions:** `[Apply]` (replaces text in editor) and `[Dismiss]`.

---

## 4. Database Schema (Supabase SQL)
Generate a `supabase/schema.sql` file with Row-Level Security (RLS) enabled for all tables (`auth.uid() = user_id`):

1. `books`:
   - `id` (uuid, PK)
   - `user_id` (uuid, FK to auth.users)
   - `title` (text)
   - `genre` (text)
   - `style_fingerprint` (jsonb) — Stores inferred author voice metrics (sentence length variance, vocabulary tone, POV, tense, stylistic quirks).
   - `global_context_summary` (text) — Cumulative high-level plot & character bible across all chapters.
   - `created_at`, `updated_at` (timestamptz)

2. `chapters`:
   - `id` (uuid, PK)
   - `book_id` (uuid, FK to books, cascade delete)
   - `user_id` (uuid, FK to auth.users)
   - `chapter_number` (int)
   - `title` (text)
   - `content` (text) — HTML/Markdown from TipTap.
   - `chapter_summary` (text) — AI-generated summary of key events, character states, and unresolved threads in this chapter.
   - `created_at`, `updated_at` (timestamptz)

---

## 5. Core Workflows & AI Architecture

### Workflow A: Authentication & Onboarding
- Clean login/signup view using Supabase Auth (Email/Password + Magic Link/OAuth).
- Dashboard listing user's books with a `+ Start First Book` modal (asks for Title and optional Genre).
- Creating a book automatically initializes `Chapter - 1` and routes directly into the Writing Workspace.

### Workflow B: Real-Time Debounced Writing Assistant
- As the user types in the Writing Board, trigger a debounced check (e.g., 2.5 seconds after typing stops, only if the active paragraph or last 2 paragraphs have changed).
- Send the **Active Paragraph(s)**, **Surrounding Local Context** (previous 2 paragraphs), **Book Style Fingerprint**, and **Previous Chapters Context Summary** to the `analyze-writing` Edge Function.
- **System Prompt Rules for `analyze-writing`:**
  - *Role:* Developmental & Line Editor.
  - *Prime Directive:* NEVER write new plot or take over the creative direction. Your job is to make the author sound like the best version of themselves.
  - *Voice Preservation:* Analyze the author's rhythm, cadence, and tone from `style_fingerprint`. If they write punchy, minimalist prose, do not suggest flowery purple prose. Elevate their articulation, fix awkward phrasing, tighten grammar, and flag continuity errors against previous chapters.
  - *Output:* Strict JSON array of suggestions:
    ```json
    {
      "suggestions": [
        {
          "id": "uuid",
          "type": "articulation" | "grammar" | "style" | "continuity",
          "original_text": "exact substring from user input",
          "suggested_text": "improved phrasing matching author voice",
          "rationale": "concise explanation of why this elevates the line"
        }
      ]
    }
    ```

### Workflow C: Cross-Chapter Context & Voice Engine
- When the user clicks `+ New Chapter` or switches away from a chapter with unsaved summary changes, trigger the `sync-chapter-context` Edge Function in the background:
  1. Summarize the current chapter's plot events, character developments, and setting details into `chapters.chapter_summary`.
  2. Roll up all `chapter_summary` entries into `books.global_context_summary` (keeping a compact Story Bible under 1,000 tokens).
  3. Extract/Update `books.style_fingerprint` based on a sample of the user's raw writing (e.g., POV: 1st/3rd person, Tense: Past/Present, Tone, Pacing).

---

## 6. Implementation Steps Required from You (The Agent)
Execute the build in the following modular order and provide complete, working code (no placeholders):

1. **Project Scaffolding:** Provide the `package.json`, Vite config (`base: './'` for GitHub Pages compatibility), Tailwind setup, and folder structure.
2. **Database & Backend Setup:** Output the complete `supabase/schema.sql` (tables + RLS policies) and the two Supabase Edge Functions (`supabase/functions/analyze-writing/index.ts` and `supabase/functions/sync-chapter-context/index.ts`). Include a client-side fallback/mock mode where a user can optionally input their OpenAI/Anthropic key in a local settings modal for instant testing before deploying Edge Functions.
3. **State & Supabase Client:** Create `src/lib/supabase.ts` and `src/store/useBookStore.ts` handling auth session, active book/chapter fetching, auto-saving, and suggestion array management.
4. **Core UI Components:**
   - `AuthScreen.tsx` (Minimalist login/signup)
   - `BookDashboard.tsx` (Create/select book)
   - `WritingWorkspace.tsx` (The wireframe layout: Top `ChapterBar`, Left `WritingBoard` with TipTap, Right `SuggestionSidebar` with interactive apply/dismiss cards).
5. **Text Replacement Logic:** Ensure clicking `[Apply]` on a suggestion card accurately locates `original_text` inside the TipTap editor state and smoothly replaces it with `suggested_text`.
6. **GitHub Pages Deployment Workflow:** Provide `.github/workflows/deploy.yml` to automatically build and deploy the Vite app to GitHub Pages on push to `main`.