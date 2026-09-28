import { db } from "../lib/dictionary-db";
import { callLLM } from "../llm/callWithMeta";

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export interface SupportedLanguageWithData extends SupportedLanguage {
  hasSourceData: boolean;
  hasTargetData: boolean;
}

export interface TranslationResult {
  translation: string;
  pos: string | null;
}

export interface TranslateWordResult {
  results: TranslationResult[];
  source: "dictionary" | "groq" | "gemini";
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", name: "English", nativeName: "English", rtl: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
  { code: "fa", name: "Persian", nativeName: "فارسی", rtl: true },
  { code: "ur", name: "Urdu", nativeName: "اردو", rtl: true },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", rtl: false },
];

export function getSupportedLanguages(): SupportedLanguageWithData[] {
  try {
    const sourceLangRows = db
      .prepare(`SELECT DISTINCT sourceLang FROM dictionary`)
      .all() as { sourceLang: string }[];
    const targetCodeRows = db
      .prepare(`SELECT DISTINCT targetCode FROM dictionary`)
      .all() as { targetCode: string }[];

    const sourceLangs = new Set(sourceLangRows.map((r) => r.sourceLang));
    const targetCodes = new Set(targetCodeRows.map((r) => r.targetCode));

    return SUPPORTED_LANGUAGES.map((lang) => ({
      ...lang,
      hasSourceData: sourceLangs.has(lang.code),
      hasTargetData: targetCodes.has(lang.code),
    }));
  } catch (error) {
    console.error("[TRANSLATION SERVICE] getSupportedLanguages", error);
    return SUPPORTED_LANGUAGES.map((lang) => ({
      ...lang,
      hasSourceData: false,
      hasTargetData: false,
    }));
  }
}

export function isValidLangCode(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

const NOT_ENTITY = `(pos IS NULL OR pos NOT IN ('name', 'proper noun'))`;

function normalize(word: string): string {
  return word.toLowerCase().trim();
}

function dedupeResults(results: TranslationResult[]): TranslationResult[] {
  const seen = new Set<string>();
  const deduped: TranslationResult[] = [];
  for (const r of results) {
    const key = `${r.translation}|${r.pos ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  return deduped;
}

function findEnglishFromWord(
  word: string,
  fromLang: string,
): TranslationResult[] {
  const normalized = normalize(word);

  const asTarget = db
    .prepare(
      `SELECT sourceWord as word, pos FROM dictionary
       WHERE targetWord = ? AND targetCode = ? AND sourceLang = ?
         AND ${NOT_ENTITY}
       LIMIT 5`,
    )
    .all(word, fromLang, "en") as { word: string; pos: string | null }[];

  const asSource = db
    .prepare(
      `SELECT targetWord as word, pos FROM dictionary
       WHERE sourceWord = ? AND sourceLang = ? AND targetCode = 'en'
         AND ${NOT_ENTITY}
       LIMIT 5`,
    )
    .all(normalized, fromLang) as { word: string; pos: string | null }[];

  return dedupeResults(
    [...asTarget, ...asSource].map((row) => ({
      translation: row.word,
      pos: row.pos,
    })),
  );
}

function translateFromDictionary(
  word: string,
  fromLang: string,
  toLang: string,
): TranslateWordResult | null {
  try {
    const normalized = normalize(word);
    if (!normalized) return null;

    // CASE 1 — fromLang = "en"
    if (fromLang === "en") {
      const rows = db
        .prepare(
          `SELECT targetWord, pos FROM dictionary
           WHERE sourceWord = ? AND sourceLang = 'en' AND targetCode = ?
             AND ${NOT_ENTITY}
           LIMIT 5`,
        )
        .all(normalized, toLang) as { targetWord: string; pos: string | null }[];

      if (rows.length === 0) return null;

      return {
        results: rows.map((r) => ({ translation: r.targetWord, pos: r.pos })),
        source: "dictionary",
      };
    }

    // CASE 2 — toLang = "en"
    if (toLang === "en") {
      const results = findEnglishFromWord(word, fromLang);
      if (results.length === 0) return null;

      return { results, source: "dictionary" };
    }

    // CASE 3 — fromLang != "en" AND toLang != "en" (bridge through English)
    const englishMatches = findEnglishFromWord(word, fromLang);
    if (englishMatches.length === 0) return null;

    const englishWord = englishMatches[0].translation;

    const rows = db
      .prepare(
        `SELECT targetWord, pos FROM dictionary
         WHERE sourceWord = ? AND sourceLang = 'en' AND targetCode = ?
           AND ${NOT_ENTITY}
         LIMIT 5`,
      )
      .all(normalize(englishWord), toLang) as {
      targetWord: string;
      pos: string | null;
    }[];

    if (rows.length === 0) return null;

    return {
      results: rows.map((r) => ({ translation: r.targetWord, pos: r.pos })),
      source: "dictionary",
    };
  } catch (error) {
    console.error("[TRANSLATION SERVICE]", error);
    return null;
  }
}

export const LANG_NAMES: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.name]),
);

function buildPrompt(word: string, fromLang: string, toLang: string): string {
  return (
    `You are a bilingual dictionary. Give the meaning of the ${LANG_NAMES[fromLang]} word "${word}" ` +
    `as ${LANG_NAMES[toLang]} translations (1 to 3 of the most common senses, written in ${LANG_NAMES[toLang]} script). ` +
    `If it is a personal name, give its ${LANG_NAMES[toLang]} form and use pos "name". ` +
    `If it is not a real word or name in ${LANG_NAMES[fromLang]}, return an empty list. ` +
    `Translate only the word itself; never answer with a person's biography or full historical name. ` +
    `Respond with JSON only: {"translations":[{"translation":"...","pos":"noun"}]}`
  );
}

function parseTranslations(text: string): TranslationResult[] {
  const parsed = JSON.parse(text) as {
    translations?: { translation?: string; pos?: string }[];
  };
  return dedupeResults(
    (parsed.translations ?? [])
      .filter((t) => typeof t.translation === "string" && t.translation.trim())
      .map((t) => ({ translation: t.translation!.trim(), pos: t.pos?.trim() || null })),
  ).slice(0, 3);
}

async function translateFromLLM(
  word: string,
  fromLang: string,
  toLang: string,
): Promise<TranslateWordResult | null> {
  const { output, provider } = await callLLM({
    step: "word",
    prompt: buildPrompt(word, fromLang, toLang),
  });

  try {
    const results = parseTranslations(output);
    return results.length ? { results, source: provider } : null;
  } catch {
    console.error("[TRANSLATION SERVICE] LLM returned invalid JSON for word lookup");
    return null;
  }
}

export type DetailField = "definition" | "synonyms" | "antonyms" | "example";
export const DETAIL_FIELDS: DetailField[] = ["definition", "synonyms", "antonyms", "example"];

export interface WordDetails {
  definition?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

const cleanList = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))].slice(0, 8)
    : [];

export async function getWordDetails(
  word: string,
  lang: string,
  fields: DetailField[],
): Promise<WordDetails | null> {
  const langName = LANG_NAMES[lang];
  const wanted: Record<DetailField, string> = {
    definition: `"definition": a short English definition (max 25 words)`,
    synonyms: `"synonyms": array of up to 6 ${langName} synonyms written in ${langName} script`,
    antonyms: `"antonyms": array of up to 6 ${langName} antonyms written in ${langName} script (empty array if none exist)`,
    example: `"example": one short natural example sentence in ${langName} using the word`,
  };

  const prompt =
    `You are a lexicographer. For the ${langName} word "${word}", return a JSON object with exactly these keys: ` +
    fields.map((f) => wanted[f]).join("; ") +
    `. Describe only the word itself, never a person or biography. ` +
    `If it is not a real ${langName} word or name, return empty values.`;

  const { output: text } = await callLLM({ step: "details", prompt });

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const details: WordDetails = {};
    if (fields.includes("definition")) details.definition = typeof parsed.definition === "string" ? parsed.definition.trim() : "";
    if (fields.includes("synonyms")) details.synonyms = cleanList(parsed.synonyms);
    if (fields.includes("antonyms")) details.antonyms = cleanList(parsed.antonyms);
    if (fields.includes("example")) details.example = typeof parsed.example === "string" ? parsed.example.trim() : "";
    return details;
  } catch (error) {
    console.error("[TRANSLATION SERVICE] Groq returned invalid JSON for details", error);
    return null;
  }
}

export async function translateWord(
  word: string,
  fromLang: string,
  toLang: string,
): Promise<TranslateWordResult | null> {
  const dictionaryResult = translateFromDictionary(word, fromLang, toLang);
  if (dictionaryResult) return dictionaryResult;

  return translateFromLLM(word, fromLang, toLang);
}
