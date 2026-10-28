import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useBookStore } from './store/useBookStore';
import { AuthScreen } from './components/AuthScreen';
import { BookDashboard } from './components/BookDashboard';
import { WritingWorkspace } from './components/WritingWorkspace';

function App() {
  const { user, setUser, activeBook } = useBookStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!activeBook) {
    return <BookDashboard onBookSelected={() => {}} />;
  }

  return <WritingWorkspace />;
}

export default App;
