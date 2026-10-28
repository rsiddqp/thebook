import React, { useState } from 'react';
import { useBookStore } from '../store/useBookStore';

export const ChapterBar: React.FC = () => {
  const { activeBook, chapters, activeChapter, setActiveChapter, createChapter } = useBookStore();
  const [showNewChapterModal, setShowNewChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBook || !newChapterTitle.trim()) return;

    setCreating(true);
    await createChapter(activeBook.id, newChapterTitle);
    setCreating(false);
    setShowNewChapterModal(false);
    setNewChapterTitle('');
  };

  if (!activeBook) return null;

  return (
    <>
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-900">{activeBook.title}</h2>
            <div className="h-6 w-px bg-slate-300"></div>
            <select
              value={activeChapter?.id || ''}
              onChange={(e) => setActiveChapter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  Chapter {chapter.chapter_number}: {chapter.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewChapterModal(true)}
              className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              + New Chapter
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {useBookStore.getState().autoSaving ? 'Saving...' : 'Saved'}
            </span>
            <div className={`w-2 h-2 rounded-full ${useBookStore.getState().autoSaving ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
          </div>
        </div>
      </div>

      {/* New Chapter Modal */}
      {showNewChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Create New Chapter</h2>
            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div>
                <label htmlFor="chapter-title" className="block text-sm font-medium text-slate-700 mb-1">
                  Chapter Title *
                </label>
                <input
                  id="chapter-title"
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Enter chapter title"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChapterModal(false);
                    setNewChapterTitle('');
                  }}
                  className="flex-1 bg-slate-100 text-slate-900 py-2 px-4 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={creating || !newChapterTitle.trim()}
                >
                  {creating ? 'Creating...' : 'Create Chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
