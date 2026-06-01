import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import api from "../lib/api";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fontSize, setFontSize] = useState("medium");
  const [defaultSourceLang, setDefaultSourceLang] = useState("bn");
  const [displayName, setDisplayName] = useState("");
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/api/users/profile");
      setDisplayName(response.data.displayName || "");
      setFontSize(response.data.fontSize || "medium");
      setDefaultSourceLang(response.data.defaultSourceLang || "bn");
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
      });
      alert("Settings saved!");
    } catch (error) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold text-primary mb-8">{t("settings.title")}</h1>

      <div className="bg-surface rounded-lg shadow-lg p-8 space-y-6">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Display Name
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
              onClick={() => toggleTheme()}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                theme === "light"
                  ? "bg-primary text-white"
                  : "bg-primary/20 text-primary hover:bg-primary/30"
              }`}
            >
              ☀️ {t("settings.light")}
            </button>
            <button
              onClick={() => toggleTheme()}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                theme === "dark"
                  ? "bg-primary text-white"
                  : "bg-primary/20 text-primary hover:bg-primary/30"
              }`}
            >
              🌙 {t("settings.dark")}
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
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                language === "en"
                  ? "bg-primary text-white"
                  : "bg-primary/20 text-primary hover:bg-primary/30"
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguage("bn")}
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                language === "bn"
                  ? "bg-primary text-white"
                  : "bg-primary/20 text-primary hover:bg-primary/30"
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
            onChange={(e) => setFontSize(e.target.value)}
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
            <option value="bn">Bengali</option>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="fa">Persian</option>
            <option value="ur">Urdu</option>
            <option value="tr">Turkish</option>
          </select>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary hover:bg-accent text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : t("common.save")}
        </button>
      </div>
    </div>
  );
}
