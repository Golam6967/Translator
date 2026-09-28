import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useFontSize } from "../contexts/FontSizeContext";
import { useToast } from "../contexts/ToastContext";
import api from "../lib/api";
import { languages } from "../lib/languages";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultSourceLang, setDefaultSourceLang] = useState(
    () => localStorage.getItem("defaultSourceLang") || "en",
  );
  const [displayName, setDisplayName] = useState("");
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  const { showToast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/api/users/profile");
      setDisplayName(response.data.displayName || "");
      const savedLang = response.data.defaultSourceLang;
      setDefaultSourceLang(
        languages.some((l) => l.code === savedLang) ? savedLang : "en",
      );
      setFontSize(response.data.fontSize || "medium");
      setLanguage(response.data.language || "en");
      setTheme(response.data.theme || "light");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/users/profile", {
        displayName,
        fontSize,
        defaultSourceLang,
        language,
        theme,
      });
      localStorage.setItem("defaultSourceLang", defaultSourceLang);
      showToast("Settings saved!", "success");
    } catch (error) {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 sm:px-8 py-10 space-y-6">
        <Skeleton className="h-10 w-52" />
        <div className="bg-surface rounded-xl shadow-card p-8 space-y-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-10">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold text-primary mb-8"
      >
        {t("settings.title")}
      </motion.h1>

      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 space-y-6"
      >
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            {t("auth.displayName")}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-text mb-4">
            {t("settings.theme")}
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all duration-200 focus-ring active:scale-[0.98] ${
                theme === "light"
                  ? "bg-primary text-white shadow-soft"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              <Sun className="w-4 h-4" /> {t("settings.light")}
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all duration-200 focus-ring active:scale-[0.98] ${
                theme === "dark"
                  ? "bg-primary text-white shadow-soft"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              <Moon className="w-4 h-4" /> {t("settings.dark")}
            </button>
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-text mb-4">
            {t("settings.language")}
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setLanguage("en")}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all duration-200 focus-ring active:scale-[0.98] ${
                language === "en"
                  ? "bg-primary text-white shadow-soft"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguage("bn")}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all duration-200 focus-ring active:scale-[0.98] ${
                language === "bn"
                  ? "bg-primary text-white shadow-soft"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              🇧🇩 বাংলা
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            {t("settings.fontSize")}
          </label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as "small" | "medium" | "large")}
            className="w-full"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        {/* Default Source Language */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            {t("settings.defaultLang")}
          </label>
          <select
            value={defaultSourceLang}
            onChange={(e) => setDefaultSourceLang(e.target.value)}
            className="w-full"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          loading={saving}
          size="lg"
          className="w-full"
        >
          {saving ? "Saving..." : t("common.save")}
        </Button>
      </Card>
    </div>
  );
}
