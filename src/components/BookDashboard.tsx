import React, { useEffect, useState } from 'react';
import { useBookStore } from '../store/useBookStore';

export const BookDashboard: React.FC<{ onBookSelected: () => void }> = ({ onBookSelected }) => {
  const { books, fetchBooks, createBook, setActiveBook, loading } = useBookStore();
  const [showModal, setShowModal] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;

    setCreating(true);
    const book = await createBook(newBookTitle, newBookGenre || undefined);
    setCreating(false);

    if (book) {
      setShowModal(false);
      setNewBookTitle('');
      setNewBookGenre('');
      onBookSelected();
    }
  };

  const handleSelectBook = async (bookId: string) => {
    await setActiveBook(bookId);
    onBookSelected();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Your Books</h1>
          <p className="text-slate-600">Select a book to continue writing or start a new one</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Start Your First Book</h2>
            <p className="text-slate-600 mb-6">Begin your writing journey with AI-powered editorial support</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-slate-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              + Create Your First Book
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => handleSelectBook(book.id)}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-left hover:shadow-md transition-shadow group"
                >
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-slate-700">
                    {book.title}
                  </h3>
                  {book.genre && (
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full mb-2">
                      {book.genre}
                    </span>
                  )}
                  <p className="text-sm text-slate-500">
                    Updated {new Date(book.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-slate-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              + Start New Book
            </button>
          </>
        )}
      </div>

      {/* Create Book Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Create New Book</h2>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                  Book Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Enter your book title"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="genre" className="block text-sm font-medium text-slate-700 mb-1">
                  Genre (Optional)
                </label>
                <input
                  id="genre"
                  type="text"
                  value={newBookGenre}
                  onChange={(e) => setNewBookGenre(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="e.g., Fantasy, Mystery, Romance"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setNewBookTitle('');
                    setNewBookGenre('');
                  }}
                  className="flex-1 bg-slate-100 text-slate-900 py-2 px-4 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={creating || !newBookTitle.trim()}
                >
                  {creating ? 'Creating...' : 'Create Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
