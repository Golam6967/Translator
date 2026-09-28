import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, BookmarkX } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import api from "../lib/api";
import Card from "../components/ui/Card";
import Skeleton from "../components/ui/Skeleton";
import ConfirmDialog from "../components/ui/ConfirmDialog";

interface SavedTranslation {
  id: string;
  originalText: string;
  sourceLang: string;
  translations: { [key: string]: string };
  tags: string[];
  createdAt: string;
}

export default function SavedLibraryPage() {
  const [saved, setSaved] = useState<SavedTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { t } = useLanguage();
  const { showToast } = useToast();

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    try {
      const response = await api.get("/api/saved");
      setSaved(response.data.saved);
    } catch (error) {
      console.error("Failed to fetch saved translations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);

    try {
      await api.delete(`/api/saved/${id}`);
      setSaved((prev) => prev.filter((s) => s.id !== id));
      showToast("Translation deleted", "success");
    } catch (error) {
      console.error("Failed to delete:", error);
      showToast("Failed to delete translation", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-primary mb-8"
      >
        {t("saved.title")}
      </motion.h1>

      {loading ? (
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-6 shadow-card space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-3/4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
          ))}
        </div>
      ) : saved.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-text/60"
        >
          <BookmarkX className="w-12 h-12 mx-auto mb-4 text-text/30" />
          <p>{t("saved.empty")}</p>
        </motion.div>
      ) : (
        <div className="grid gap-6">
          <AnimatePresence>
            {saved.map((item, i) => (
              <Card
                key={item.id}
                accent
                hover
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-text/60 mb-2">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-text/80 font-semibold mb-4">
                      "{item.originalText.substring(0, 100)}..."
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(item.translations).map(([langCode, text]) => (
                        <div
                          key={langCode}
                          className="bg-background rounded-lg p-3 text-sm"
                        >
                          <p className="text-primary font-bold mb-1">
                            {langCode.toUpperCase()}
                          </p>
                          <p className="text-text/80 text-xs">
                            {text.substring(0, 60)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setPendingDelete(item.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors ml-4 focus-ring shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
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
        title="Delete this translation?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
