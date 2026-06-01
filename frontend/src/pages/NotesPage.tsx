import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import notesService, { Note } from "../services/notesService";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const data = await notesService.getNotes();
      setNotes(data.notes);
      setError("");
    } catch (err: any) {
      console.error("Failed to fetch notes:", err);
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (note?: Note) => {
    if (note) {
      // Edit mode
      setEditingId(note.id);
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(", "));
      setLanguage(note.language);
    } else {
      // Create mode
      setEditingId(null);
      setTitle("");
      setContent("");
      setTags("");
      setLanguage("en");
    }
    setShowForm(true);
    setError("");
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setTags("");
    setError("");
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }

    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        language,
      };

      if (editingId) {
        // Update existing note
        await notesService.updateNote(editingId, noteData);
      } else {
        // Create new note
        await notesService.createNote(noteData);
      }

      handleCloseForm();
      fetchNotes();
    } catch (err: any) {
      console.error("Failed to save note:", err);
      setError(err.response?.data?.error || "Failed to save note");
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await notesService.deleteNote(id);
      fetchNotes();
    } catch (err: any) {
      console.error("Failed to delete note:", err);
      setError("Failed to delete note");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-primary">{t("notes.title")}</h1>
        <button
          onClick={() => handleOpenForm()}
          className="bg-accent hover:bg-primary text-white font-bold px-6 py-2 rounded-lg transition-colors"
        >
          {t("notes.new")}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSaveNote}
          className="bg-surface rounded-lg p-6 shadow-lg mb-8 border-l-4 border-accent"
        >
          <h2 className="text-2xl font-bold text-primary mb-6">
            {editingId ? "Edit Note" : "Create New Note"}
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-2">
              {t("notes.title_label")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background text-text focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-2">
              {t("notes.content")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Note content..."
              className="w-full h-64 p-4 border border-primary/20 rounded-lg bg-background text-text focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {t("notes.tags")}
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="islam, quran, history"
                className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background text-text focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {t("notes.language")}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-primary/20 rounded-lg bg-background text-text focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-accent text-white font-bold py-2 rounded-lg transition-colors"
            >
              {editingId ? "Update Note" : t("notes.save")}
            </button>
            <button
              type="button"
              onClick={handleCloseForm}
              className="flex-1 bg-text/20 hover:bg-text/30 text-text font-bold py-2 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p>{t("common.loading")}</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-text/60">
          <p>No notes yet. Create your first note!</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-surface rounded-lg p-6 shadow-lg border-l-4 border-primary hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary">
                    {note.title}
                  </h3>
                  <p className="text-sm text-text/60">
                    {new Date(note.createdAt).toLocaleDateString()}
                    {note.updatedAt !== note.createdAt && " (edited)"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenForm(note)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-lg"
                    title="Edit note"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-red-600 hover:text-red-800 font-bold text-lg"
                    title="Delete note"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <p className="text-text/80 mb-3 line-clamp-3">{note.content}</p>

              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
