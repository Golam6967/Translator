import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, AlertCircle, NotebookPen } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import notesService, { Note } from "../services/notesService";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Skeleton from "../components/ui/Skeleton";
import ConfirmDialog from "../components/ui/ConfirmDialog";

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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { t } = useLanguage();
  const { showToast } = useToast();

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
      setEditingId(note.id);
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(", "));
      setLanguage(note.language);
    } else {
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
        await notesService.updateNote(editingId, noteData);
        showToast("Note updated", "success");
      } else {
        await notesService.createNote(noteData);
        showToast("Note created", "success");
      }

      handleCloseForm();
      fetchNotes();
    } catch (err: any) {
      console.error("Failed to save note:", err);
      setError(err.response?.data?.error || "Failed to save note");
    }
  };

  const handleDeleteNote = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);

    try {
      await notesService.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast("Note deleted", "success");
    } catch (err: any) {
      console.error("Failed to delete note:", err);
      showToast("Failed to delete note", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-primary"
        >
          {t("notes.title")}
        </motion.h1>
        <Button
          variant={showForm ? "secondary" : "primary"}
          icon={<Plus />}
          onClick={() => (showForm ? handleCloseForm() : handleOpenForm())}
        >
          {showForm ? t("common.cancel") : t("notes.new")}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg overflow-hidden"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={handleSaveNote}
            className="overflow-hidden"
          >
            <Card accent className="p-6 mb-8">
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
                  className="w-full"
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
                  className="w-full h-64 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    {t("notes.tags")}
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="islam, quran, history"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    {t("notes.language")}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full"
                  >
                    <option value="en">English</option>
                    <option value="bn">বাংলা</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  {editingId ? "Update Note" : t("notes.save")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={handleCloseForm}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-6 shadow-card space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-text/60"
        >
          <NotebookPen className="w-12 h-12 mx-auto mb-4 text-text/30" />
          <p>No notes yet. Create your first note!</p>
        </motion.div>
      ) : (
        <div className="grid gap-6">
          <AnimatePresence>
            {notes.map((note, i) => (
              <Card
                key={note.id}
                hover
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="p-6 border-l-4 border-primary"
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenForm(note)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-colors focus-ring"
                      title="Edit note"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(note.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors focus-ring"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
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
              </Card>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this note?"
        description="This action cannot be undone."
        onConfirm={handleDeleteNote}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
