import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  X,
  Keyboard,
  ArrowLeftRight,
  BookOpen,
  Equal,
  Quote,
  Languages as LanguagesIcon,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import api from "../lib/api";
import { languages, getLanguage } from "../lib/languages";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import LanguageBadge from "../components/ui/LanguageBadge";
import Skeleton from "../components/ui/Skeleton";
import VirtualKeyboard from "../components/ui/VirtualKeyboard";
import { Dropdown, MultiDropdown, DropdownOption } from "../components/ui/Dropdown";

interface TranslationEntry {
  translation: string;
  pos: string | null;
}

type DetailField = "definition" | "synonyms" | "antonyms" | "example";

interface WordDetails {
  definition?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; data: WordDetails };

interface ResultSnapshot {
  word: string;
  sourceLang: string;
  translations: Record<string, TranslationEntry[]>;
  detailFields: DetailField[];
}

const RTL_LANGS = new Set(["ar", "fa", "ur"]);
const DETAIL_FIELDS: DetailField[] = ["definition", "synonyms", "antonyms", "example"];

const INFO_OPTIONS: DropdownOption[] = [
  {
    value: "translations",
    label: "Translations",
    description: "Always shown",
    leading: <LanguagesIcon className="w-5 h-5 text-primary" />,
  },
  {
    value: "definition",
    label: "Definition",
    description: "Short English meaning",
    leading: <BookOpen className="w-5 h-5 text-primary" />,
  },
  {
    value: "synonyms",
    label: "Synonyms",
    description: "Words with a similar meaning",
    leading: <Equal className="w-5 h-5 text-primary" />,
  },
  {
    value: "antonyms",
    label: "Antonyms",
    description: "Words with the opposite meaning",
    leading: <ArrowLeftRight className="w-5 h-5 text-primary" />,
  },
  {
    value: "example",
    label: "Example sentence",
    description: "The word used in context",
    leading: <Quote className="w-5 h-5 text-primary" />,
  },
];

const languageOptions: DropdownOption[] = languages.map((l) => ({
  value: l.code,
  label: l.name,
  description: l.native,
  leading: <LanguageBadge lang={l} />,
}));

function Chips({ items, lang }: { items: string[]; lang: string }) {
  if (items.length === 0) return <span className="text-sm text-text/40">None found</span>;
  return (
    <div className="flex flex-wrap gap-2" dir={RTL_LANGS.has(lang) ? "rtl" : "ltr"}>
      {items.map((item) => (
        <span
          key={item}
          className="px-3 py-1 rounded-full bg-primary/[0.07] text-sm text-text/85"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailSections({
  fields,
  lang,
  state,
}: {
  fields: DetailField[];
  lang: string;
  state?: DetailState;
}) {
  const heading = (text: string) => (
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text/45 mb-1.5">
      {text}
    </h4>
  );

  if (!state || state.status === "loading") {
    return (
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f}>
            {heading(f)}
            <Skeleton className="h-6 w-3/4 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="text-sm text-text/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Details are unavailable right now.
      </p>
    );
  }

  const { data } = state;
  const rtl = RTL_LANGS.has(lang) ? "rtl" : "ltr";

  return (
    <div className="space-y-4">
      {fields.includes("definition") && (
        <div>
          {heading("Definition")}
          <p className="text-sm text-text/85">{data.definition || "Not available"}</p>
        </div>
      )}
      {fields.includes("synonyms") && (
        <div>
          {heading("Synonyms")}
          <Chips items={data.synonyms ?? []} lang={lang} />
        </div>
      )}
      {fields.includes("antonyms") && (
        <div>
          {heading("Antonyms")}
          <Chips items={data.antonyms ?? []} lang={lang} />
        </div>
      )}
      {fields.includes("example") && (
        <div>
          {heading("Example")}
          <p className="text-sm text-text/85 italic" dir={rtl}>
            {data.example || "Not available"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TranslatePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState(
    () => localStorage.getItem("defaultSourceLang") || "en",
  );
  const [targetLangs, setTargetLangs] = useState<string[]>(() => {
    const initialSource = localStorage.getItem("defaultSourceLang") || "en";
    return languages
      .filter((l) => l.code !== initialSource)
      .slice(0, 2)
      .map((l) => l.code);
  });
  const [infoFields, setInfoFields] = useState<string[]>(["translations", "synonyms"]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [result, setResult] = useState<ResultSnapshot | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const targetOptions = useMemo(
    () => languageOptions.filter((o) => o.value !== sourceLang),
    [sourceLang],
  );

  const changeSource = (code: string) => {
    setSourceLang(code);
    setTargetLangs((prev) => prev.filter((c) => c !== code));
  };

  const swapLanguages = () => {
    if (targetLangs.length === 0) return;
    const newSource = targetLangs[0];
    setTargetLangs([sourceLang, ...targetLangs.slice(1)]);
    setSourceLang(newSource);
    const carried = result?.translations[newSource]?.[0]?.translation;
    if (carried) setText(carried);
  };

  const fetchDetails = (
    id: number,
    key: string,
    word: string,
    lang: string,
    fields: DetailField[],
  ) => {
    api
      .post("/api/translate/details", { word, lang, fields })
      .then((res) => {
        if (id !== requestId.current) return;
        setDetails((d) => ({ ...d, [key]: { status: "done", data: res.data } }));
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setDetails((d) => ({ ...d, [key]: { status: "error" } }));
      });
  };

  const handleTranslate = async () => {
    const word = text.trim();

    if (!word) {
      setError("Please enter a word to translate");
      return;
    }
    if (/\s/.test(word)) {
      setError("Only single-word lookup is supported right now");
      return;
    }
    if (targetLangs.length === 0) {
      setError("Please select at least one output language");
      return;
    }

    const id = ++requestId.current;
    const detailFields = DETAIL_FIELDS.filter((f) => infoFields.includes(f));

    setLoading(true);
    setError("");
    setResult(null);
    setDetails({});

    try {
      const settled = await Promise.all(
        targetLangs.map(async (toLang) => {
          try {
            const response = await api.post("/api/translate/word", {
              word,
              fromLang: sourceLang,
              toLang,
            });
            return [toLang, response.data.results as TranslationEntry[]] as const;
          } catch (err: any) {
            if (err.response?.status === 404) return [toLang, null] as const;
            throw err;
          }
        }),
      );

      if (id !== requestId.current) return;

      const found = settled.filter(
        (entry): entry is [string, TranslationEntry[]] => entry[1] !== null,
      );

      if (found.length === 0) {
        setError("Word not found for the selected output languages");
        return;
      }

      const translations = Object.fromEntries(found);
      setResult({ word, sourceLang, translations, detailFields });

      if (detailFields.length > 0) {
        const loadingState: Record<string, DetailState> = { source: { status: "loading" } };
        found.forEach(([lang]) => (loadingState[lang] = { status: "loading" }));
        setDetails(loadingState);

        fetchDetails(id, "source", word, sourceLang, detailFields);
        found.forEach(([lang, entries]) =>
          fetchDetails(id, lang, entries[0].translation, lang, detailFields),
        );
      }

      // Activity history is non-critical, so failures are ignored
      api
        .post("/api/history", {
          type: "translate",
          data: word,
          metadata: {
            sourceLang,
            textLength: word.length,
            targetLangs: found.map(([lang]) => lang),
          },
        })
        .catch(() => {});
    } catch (err: any) {
      setError(err.response?.data?.error || "Translation failed");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
  };

  const sourceMeta = getLanguage(sourceLang);
  const resultSource = result ? getLanguage(result.sourceLang) : undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">{t("translate.title")}</h1>
        <p className="text-text/50 mt-1">
          Look up a word across {languages.length} languages, with synonyms, antonyms and more.
        </p>
      </motion.div>

      {/* Language & output controls */}
      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 relative z-20"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <Dropdown
            label="From"
            options={languageOptions}
            value={sourceLang}
            onChange={changeSource}
          />
          <button
            type="button"
            onClick={swapLanguages}
            disabled={targetLangs.length === 0}
            title="Swap languages"
            className="hidden md:flex w-10 h-10 mb-0.5 items-center justify-center rounded-full border border-primary/15 hover:border-accent hover:bg-primary/5 transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <MultiDropdown
            label="To (output languages)"
            options={targetOptions}
            values={targetLangs}
            onChange={setTargetLangs}
            placeholder="Choose output languages"
          />
        </div>
        <div className="mt-4">
          <MultiDropdown
            label="Show in results"
            options={INFO_OPTIONS}
            values={infoFields}
            onChange={setInfoFields}
            lockedValues={["translations"]}
          />
        </div>
      </Card>

      {/* Input */}
      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 relative z-10"
      >
        <div className="flex items-center justify-between mb-3">
          <label htmlFor="word-input" className="flex items-center gap-2 text-sm font-medium">
            <LanguageBadge lang={sourceMeta} size="sm" />
            Word in {sourceMeta?.name}
          </label>
          {text && (
            <button
              onClick={() => setText("")}
              className="text-xs text-text/40 hover:text-red-500 flex items-center gap-1 transition-colors focus-ring rounded"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <input
          id="word-input"
          ref={inputRef}
          type="text"
          value={text}
          dir={RTL_LANGS.has(sourceLang) ? "rtl" : "ltr"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleTranslate();
          }}
          placeholder="Enter a single word"
          maxLength={100}
          className="w-full text-2xl py-3 px-4"
        />
        <p className="text-xs text-text/40 mt-1.5">{text.length}/100 · single-word lookup</p>

        <AnimatePresence initial={false}>
          {showKeyboard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <VirtualKeyboard
                langCode={sourceLang}
                value={text}
                onChange={setText}
                inputRef={inputRef}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setShowKeyboard((s) => !s)}
            icon={<Keyboard />}
            className="sm:w-auto"
          >
            {showKeyboard ? "Hide keyboard" : "On-screen keyboard"}
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={!text.trim() || targetLangs.length === 0}
            loading={loading}
            size="lg"
            icon={!loading && <Sparkles />}
            className="flex-1"
          >
            {loading ? "Looking up..." : t("translate.translate")}
          </Button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result ? (
          <motion.section
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-primary">
              Results for{" "}
              <span dir={RTL_LANGS.has(result.sourceLang) ? "rtl" : "ltr"}>“{result.word}”</span>
            </h2>

            {result.detailFields.length > 0 && (
              <Card className="p-5" accent>
                <div className="flex items-center gap-3 mb-4">
                  <LanguageBadge lang={resultSource} />
                  <div>
                    <p className="font-bold">About the word</p>
                    <p className="text-xs text-text/45">{resultSource?.name}</p>
                  </div>
                </div>
                <DetailSections
                  fields={result.detailFields}
                  lang={result.sourceLang}
                  state={details.source}
                />
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {Object.entries(result.translations).map(([langCode, entries], i) => {
                const lang = getLanguage(langCode);
                const rtl = RTL_LANGS.has(langCode) ? "rtl" : "ltr";
                return (
                  <Card
                    key={langCode}
                    hover
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <LanguageBadge lang={lang} />
                        <div>
                          <p className="font-bold leading-tight">{lang?.name}</p>
                          <p className="text-xs text-text/45">{lang?.native}</p>
                        </div>
                      </div>
                      {entries.length > 1 && (
                        <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5">
                          {entries.length} results
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {entries.map((entry, j) => {
                        const key = `${langCode}-${j}`;
                        return (
                          <li
                            key={key}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-primary/[0.04]"
                          >
                            <div className="min-w-0">
                              <p className="text-lg leading-relaxed break-words" dir={rtl}>
                                {entry.translation}
                              </p>
                              {entry.pos && (
                                <span className="text-[11px] text-text/40 italic">{entry.pos}</span>
                              )}
                            </div>
                            <button
                              onClick={() => copy(key, entry.translation)}
                              className="p-2 shrink-0 hover:bg-primary/10 rounded-lg transition-colors focus-ring"
                              title="Copy"
                            >
                              {copiedKey === key ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {result.detailFields.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-primary/10">
                        <p className="text-xs text-text/45 mb-3">
                          About “<span dir={rtl}>{entries[0].translation}</span>”
                        </p>
                        <DetailSections
                          fields={result.detailFields}
                          lang={langCode}
                          state={details[langCode]}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </motion.section>
        ) : (
          !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border-2 border-dashed border-primary/10 py-12 px-6 text-center"
            >
              <div className="flex justify-center -space-x-2 mb-4">
                {(targetLangs.length ? targetLangs : targetOptions.slice(0, 3).map((o) => o.value))
                  .slice(0, 5)
                  .map((code) => (
                    <LanguageBadge key={code} lang={getLanguage(code)} size="lg" />
                  ))}
              </div>
              <p className="text-text/60 font-medium">Your results will appear here</p>
              <p className="text-text/40 text-sm mt-1">
                Pick your languages, choose what to show, then enter a word.
              </p>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
