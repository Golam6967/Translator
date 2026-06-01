import React, { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import api from "../lib/api";

const languageOptions = [
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "fa", name: "Persian", flag: "🇮🇷" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
];

interface TranslationResult {
  [langCode: string]: string;
}

export default function TranslatePage() {
  const [loader, setLoader] = useState(false);
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState("bn");
  const [selectedLanguages, setSelectedLanguages] = useState(["en"]);
  const [translations, setTranslations] = useState<TranslationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const handleTranslate = async () => {
    if (!text.trim()) {
      setError("Please enter text to translate");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/api/translate", {
        text,
        sourceLang,
        targetLangs: selectedLanguages,
      });

      setTranslations(response.data.translations);
    } catch (err: any) {
      setError(err.response?.data?.error || "Translation failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (code: string) => {
    if (selectedLanguages.includes(code)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== code));
    } else {
      setSelectedLanguages([...selectedLanguages, code]);
    }
  };

  const saveTranslation = async () => {
    if (!translations) return;

    try {
      await api.post("/api/saved", {
        originalText: text,
        sourceLang,
        translations,
        tags: [],
      });
      alert("Translation saved!");
    } catch (err: any) {
      alert("Failed to save translation");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const speak = async (text: string, lang: string) => {
    console.log("Synthesizing speech for:", text, `[Language: ${lang}]`);

    try {
      // 🌟 Axios expects: api.post(url, data, config)
      setLoader(true);
      const response = await api.post(
        "/api/translate/generate-audio", // Your base Axios instance handles the /api prefix or localhost domain
        { text, lang }, // Slot #2: Raw data object (Axios strings this automatically!)
        { responseType: "blob" }, // Slot #3: Crucial option so Axios captures raw binary wav files
      );

      // 🌟 Axios stores the actual server response payload inside response.data
      const audioBlob = response.data;

      // Convert the raw binary blob into an in-memory stream URL
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        console.log("Playback complete. Releasing RAM cache.");
        URL.revokeObjectURL(audioUrl); // Clean up memory reference pointer
      };

      audio.onerror = (err) => {
        console.error("Audio element error:", err);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setLoader(false);
    } catch (error) {
      console.error("Frontend TTS stream fetching failed:", error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-primary mb-8">
        {t("translate.title")}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="bg-surface rounded-lg p-6 shadow-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-2">
              {t("translate.sourceLang")}
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full"
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block text-sm font-medium text-text mb-2">
            {t("translate.enterText")}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("translate.enterText")}
            className="w-full h-64 p-4 border border-primary/20 rounded-lg bg-background text-text focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
          />

          <button
            onClick={handleTranslate}
            disabled={loading || !text.trim()}
            className="w-full mt-4 bg-primary hover:bg-accent text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "🔄 Translating..." : t("translate.translate")}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Language Selection */}
        <div className="bg-surface rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-bold text-primary mb-4">
            {t("translate.targetLangs")}
          </h3>
          <div className="space-y-2">
            {languageOptions
              .filter((lang) => lang.code !== sourceLang)
              .map((lang) => (
                <label
                  key={lang.code}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={() => toggleLanguage(lang.code)}
                    className="w-4 h-4"
                  />
                  <span className="text-2xl">{lang.flag}</span>
                  <span>{lang.name}</span>
                </label>
              ))}
          </div>
        </div>
      </div>

      {/* Translations Output */}
      {translations && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-primary mb-6">Translations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(translations).map(([langCode, translation]) => {
              const lang = languageOptions.find((l) => l.code === langCode);
              return (
                <div
                  key={langCode}
                  className="bg-surface rounded-lg p-6 shadow-lg border-l-4 border-accent"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">
                      {lang?.flag} {lang?.name}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        disabled={loader}
                        onClick={() => speak(translation as string, langCode)}
                        className=" p-2 hover:bg-primary/10 rounded-lg transition-colors"
                        title="Speak"
                      >
                        🔊
                      </button>
                      <button
                        onClick={() => copyToClipboard(translation as string)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                        title="Copy"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <p className="text-text/80 leading-relaxed whitespace-pre-wrap">
                    {translation as string}
                  </p>
                </div>
              );
            })}
          </div>

          <button
            onClick={saveTranslation}
            className="mt-6 w-full bg-accent hover:bg-primary text-white font-bold py-3 rounded-lg transition-colors"
          >
            {t("translate.save")}
          </button>
        </div>
      )}
    </div>
  );
}
