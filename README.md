# MusePad - AI Book-Writing Companion

A real-time editorial companion for aspiring book authors. MusePad observes your writing and provides intelligent suggestions for phrasing, articulation, grammar, and structure—all while preserving your unique voice.

## Features

- **Distraction-Free Writing**: Clean, minimalist interface with TipTap rich-text editor
- **Real-Time AI Suggestions**: Get contextual editorial feedback as you write
- **Voice Preservation**: AI learns and maintains your unique writing style
- **Multi-Chapter Management**: Organize your book into chapters with automatic context tracking
- **Cross-Chapter Continuity**: AI maintains story consistency across all chapters
- **Auto-Save**: Never lose your work with automatic cloud saving

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Editor**: TipTap
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: OpenAI GPT-4o-mini
- **Hosting**: GitHub Pages + Serverless

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Supabase account
- An OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Thebook
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the contents of `supabase/schema.sql`

5. Deploy Edge Functions:
   - Install Supabase CLI: `npm install -g supabase`
   - Login: `supabase login`
   - Link your project: `supabase link --project-ref your-project-ref`
   - Set OpenAI API key: `supabase secrets set OPENAI_API_KEY=your_openai_api_key`
   - Deploy functions:
     ```bash
     supabase functions deploy analyze-writing
     supabase functions deploy sync-chapter-context
     ```

6. Run the development server:
```bash
npm run dev
```

### Deployment

The project is configured for automatic deployment to GitHub Pages:

1. Push your code to the `main` branch
2. GitHub Actions will automatically build and deploy
3. Enable GitHub Pages in your repository settings (Settings → Pages → Source: GitHub Actions)

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx          # Login/signup interface
│   │   ├── BookDashboard.tsx       # Book selection/creation
│   │   ├── ChapterBar.tsx          # Chapter navigation
│   │   ├── SuggestionSidebar.tsx   # AI suggestion cards
│   │   └── WritingWorkspace.tsx    # Main editor workspace
│   ├── lib/
│   │   └── supabase.ts             # Supabase client setup
│   ├── store/
│   │   └── useBookStore.ts         # Zustand state management
│   ├── App.tsx                     # Main app component
│   └── main.tsx                    # Entry point
├── supabase/
│   ├── schema.sql                  # Database schema
│   └── functions/
│       ├── analyze-writing/        # Real-time suggestion engine
│       └── sync-chapter-context/   # Context & style extraction
└── .github/
    └── workflows/
        └── deploy.yml              # GitHub Pages deployment
```

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Create a Book**: Click "Start New Book" and enter a title
3. **Start Writing**: Begin typing in the editor
4. **Review Suggestions**: AI suggestions appear in the right sidebar after a brief pause
5. **Apply or Dismiss**: Click "Apply" to accept a suggestion or "Dismiss" to ignore it
6. **Manage Chapters**: Use the chapter dropdown to switch between chapters or create new ones

## How It Works

### AI Editorial System

1. **Debounced Analysis**: After you pause typing for 2.5 seconds, the active paragraphs are sent to the AI
2. **Context-Aware**: The AI considers:
   - Your writing style fingerprint (POV, tense, tone, rhythm)
   - Previous paragraphs for local context
   - Previous chapters for story continuity
3. **Voice Preservation**: The AI never rewrites your story—it only suggests improvements that match your voice
4. **Structured Output**: Suggestions are categorized as Articulation, Grammar, Style, or Continuity

### Data Privacy

- All content is stored securely in your Supabase database
- Row-Level Security (RLS) ensures only you can access your books
- AI analysis happens through secure Edge Functions

## License

MIT License - feel free to use this project for your own writing journey!

## Support

For issues or questions, please open an issue on GitHub.
