import glossaryData from "./glossary.json";

export interface GlossaryWarning {
  id: string;
  term: string;
  expected: string[];
}

interface Form {
  raw: string;
  norm: string;
}

interface Entry {
  id: string;
  forms: Record<string, Form[]>;
}

const ARABIC_SCRIPT_LANGS = new Set(["ar", "fa", "ur"]);

// Letter variants folded to one canonical Arabic-script letter (after NFD strips marks).
const ARABIC_FOLDS: Record<string, string> = {
  "ى": "ي",
  "ی": "ي",
  "ې": "ي",
  "ے": "ي",
  "ک": "ك",
  "ة": "ه",
  "ۃ": "ه",
  "ہ": "ه",
  "ھ": "ه",
  "ە": "ه",
  "ں": "ن",
};

const ARABIC_PREFIXES = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];
const ARABIC_SUFFIXES = new Set([
  "", "ه", "ها", "هم", "هما", "ك", "ي", "ا", "ات", "ان", "ين", "ون", "ن", "وا",
]);

export function normalizeText(text: string): string {
  let out = text.toLocaleLowerCase("tr").normalize("NFD");
  out = out.replace(/[̀-ًͯ-ٰٟۖ-ۭـ]/g, "");
  out = out.replace(/ı/g, "i").replace(/[’‘`]/g, "'");
  out = out.replace(/[ىیېےکةۃہھەں]/g, (c) => ARABIC_FOLDS[c] ?? c);
  out = out.replace(/[‌‍]/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matchesArabicScript(normText: string, form: string): boolean {
  for (const token of normText.split(/[^\p{L}\p{N}]+/u)) {
    if (!token) continue;
    const candidates = [token];
    for (const prefix of ARABIC_PREFIXES) {
      if (token.startsWith(prefix) && token.length > prefix.length) {
        candidates.push(token.slice(prefix.length));
      }
    }
    for (const c of candidates) {
      if (c === form) return true;
      if (c.startsWith(form) && ARABIC_SUFFIXES.has(c.slice(form.length))) return true;
    }
  }
  return false;
}

function matchesLatin(normText: string, form: string, lang: string): boolean {
  // English allows simple inflections; Turkish is agglutinative so allow a few suffix letters.
  const suffix =
    lang === "tr" ? "\\p{L}{0,4}" : "(?:s|es|ed|ing|d|'s)?";
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(form)}${suffix}(?![\\p{L}\\p{N}])`,
    "u",
  );
  return pattern.test(normText);
}

export function containsForm(normText: string, form: string, lang: string): boolean {
  if (!form) return false;
  return ARABIC_SCRIPT_LANGS.has(lang)
    ? matchesArabicScript(normText, form)
    : matchesLatin(normText, form, lang);
}

const entries: Entry[] = (glossaryData.entries as { id: string; forms: Record<string, string[]> }[]).map(
  (e) => ({
    id: e.id,
    forms: Object.fromEntries(
      Object.entries(e.forms).map(([lang, list]) => [
        lang,
        list.map((raw) => ({ raw, norm: normalizeText(raw) })),
      ]),
    ),
  }),
);

export const GLOSSARY_SIZE = entries.length;

export function detectEntryIds(source: string, sourceLang: string): string[] {
  const normSource = normalizeText(source);
  return entries
    .filter((e) => (e.forms[sourceLang] ?? []).some((f) => containsForm(normSource, f.norm, sourceLang)))
    .map((e) => e.id);
}

export function checkGlossary(input: {
  source: string;
  draft: string;
  sourceLang: string;
  targetLang: string;
}): GlossaryWarning[] {
  const { source, draft, sourceLang, targetLang } = input;
  const normSource = normalizeText(source);
  const normDraft = normalizeText(draft);
  const warnings: GlossaryWarning[] = [];

  for (const entry of entries) {
    const sourceForms = entry.forms[sourceLang] ?? [];
    const targetForms = entry.forms[targetLang] ?? [];
    if (targetForms.length === 0) continue;

    const matched = sourceForms.find((f) => containsForm(normSource, f.norm, sourceLang));
    if (!matched) continue;

    const rendered = targetForms.some((f) => containsForm(normDraft, f.norm, targetLang));
    if (!rendered) {
      warnings.push({ id: entry.id, term: matched.raw, expected: targetForms.map((f) => f.raw) });
    }
  }

  return warnings;
}
