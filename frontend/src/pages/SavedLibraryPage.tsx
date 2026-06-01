import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import api from "../lib/api";

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
  const { t } = useLanguage();

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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this translation?")) return;

    try {
      await api.delete(`/api/saved/${id}`);
      fetchSaved();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-primary mb-8">{t("saved.title")}</h1>

      {loading ? (
        <div className="text-center py-12">
          <p>{t("common.loading")}</p>
        </div>
      ) : saved.length === 0 ? (
        <div className="text-center py-12 text-text/60">
          <p>{t("saved.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {saved.map((item) => (
            <div
              key={item.id}
              className="bg-surface rounded-lg p-6 shadow-lg border-l-4 border-accent hover:shadow-xl transition-shadow"
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
                        className="bg-background rounded p-3 text-sm"
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
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-800 font-bold ml-4"
                >
                  🗑️
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
