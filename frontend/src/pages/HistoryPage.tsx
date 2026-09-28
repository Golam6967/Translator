import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Type,
  ImageIcon,
  FileText,
  NotebookPen,
  Pin,
  X,
  Clock3,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import api from "../lib/api";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import ConfirmDialog from "../components/ui/ConfirmDialog";

interface HistoryItem {
  id: string;
  type: string;
  data: string;
  metadata: any;
  createdAt: string;
}

const typeIcons: { [key: string]: React.ComponentType<any> } = {
  translate: Type,
  translate_sentence: FileText,
  extract_image: ImageIcon,
  extract_document: FileText,
  create_note: NotebookPen,
};

const typeLabels: { [key: string]: string } = {
  translate: "Translation",
  translate_sentence: "Sentence Translation",
  extract_image: "Image Extraction",
  extract_document: "Document Extraction",
  create_note: "Note Created",
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);
  const { t } = useLanguage();
  const { showToast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get("/api/history");
      setHistory(response.data.history);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try {
      await api.delete(`/api/history/${id}`);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (error) {
      console.error("Failed to delete:", error);
      showToast("Failed to delete entry", "error");
    }
  };

  const handleClear = async () => {
    setClearAll(false);
    try {
      await api.delete("/api/history/clear/all");
      setHistory([]);
      showToast("History cleared", "success");
    } catch (error) {
      console.error("Failed to clear history:", error);
      showToast("Failed to clear history", "error");
    }
  };

  const getTypeIcon = (type: string) => typeIcons[type] || Pin;
  const getTypeLabel = (type: string) => typeLabels[type] || type;

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-primary"
        >
          {t("history.title")}
        </motion.h1>
        {history.length > 0 && (
          <Button
            variant="danger"
            icon={<Trash2 />}
            onClick={() => setClearAll(true)}
          >
            {t("history.clear")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 bg-surface rounded-xl p-6 shadow-card space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-text/60"
        >
          <Clock3 className="w-12 h-12 mx-auto mb-4 text-text/30" />
          <p>{t("history.empty")}</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {history.map((item, index) => {
              const Icon = getTypeIcon(item.type);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="flex gap-4 items-start"
                >
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shrink-0 shadow-soft">
                      <Icon className="w-5 h-5" />
                    </div>
                    {index < history.length - 1 && (
                      <div className="w-1 h-16 bg-accent/30 my-2"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-surface rounded-xl p-6 shadow-card hover:shadow-lift transition-shadow duration-300 border-l-4 border-accent">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-primary">
                        {getTypeLabel(item.type)}
                      </h3>
                      <button
                        onClick={() => setPendingDelete(item.id)}
                        className="text-text/40 hover:text-red-600 transition-colors focus-ring rounded p-1"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-text/60 mb-2">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <p className="text-text/80 text-sm line-clamp-2">
                      {item.data}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this entry?"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={clearAll}
        title={t("history.clearConfirm")}
        confirmLabel={t("history.clear")}
        onConfirm={handleClear}
        onCancel={() => setClearAll(false)}
      />
    </div>
  );
}
