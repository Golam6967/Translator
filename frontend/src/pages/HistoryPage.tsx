import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import api from "../lib/api";

interface HistoryItem {
  id: string;
  type: string;
  data: string;
  metadata: any;
  createdAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

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

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/history/${id}`);
      fetchHistory();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleClear = async () => {
    if (!confirm(t("history.clearConfirm"))) return;

    try {
      await api.delete("/api/history/clear/all");
      fetchHistory();
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      translate: "🔤",
      extract_image: "🖼️",
      extract_document: "📄",
      create_note: "📝",
    };
    return icons[type] || "📌";
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      translate: "Translation",
      extract_image: "Image Extraction",
      extract_document: "Document Extraction",
      create_note: "Note Created",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-primary">{t("history.title")}</h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg transition-colors"
          >
            {t("history.clear")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p>{t("common.loading")}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-text/60">
          <p>{t("history.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className="flex gap-4 items-start"
            >
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center font-bold text-lg">
                  {getTypeIcon(item.type)}
                </div>
                {index < history.length - 1 && (
                  <div className="w-1 h-16 bg-accent/30 my-2"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 bg-surface rounded-lg p-6 shadow-lg border-l-4 border-accent">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-primary">
                    {getTypeLabel(item.type)}
                  </h3>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-bold"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm text-text/60 mb-2">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="text-text/80 text-sm line-clamp-2">
                  {item.data}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
