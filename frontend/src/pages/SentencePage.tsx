import { useState } from "react";
import api from "../lib/api";
import { languages, getLanguage } from "../lib/languages";

const MAX_LENGTH = 2000;
const RTL_LANGS = new Set(["ar", "fa", "ur"]);
const dirOf = (lang: string) => (RTL_LANGS.has(lang) ? "rtl" : "ltr");

interface VerificationIssue {
  type: string;
  sourceSnippet: string;
  draftSnippet: string;
  explanation: string;
}

interface StepMeta {
  name: string;
  provider: "groq" | "gemini" | null;
  fallbackUsed: boolean;
  latencyMs: number;
}

interface SentenceResult {
  translation: string;
  verification: {
    status: "passed" | "issues_found" | "skipped";
    confidence: "high" | "medium" | "low" | null;
    issues: VerificationIssue[];
    revisionApplied: boolean;
    originalDraft: string | null;
  };
  glossaryWarnings: { term: string; expected: string[] }[];
  flags: { term: string; reason: string; note: string; alternatives: string[] }[];
  notice: string | null;
  meta: { steps: StepMeta[]; totalLatencyMs: number };
}

interface Submitted {
  sourceLang: string;
  targetLang: string;
}

const STATUS_LABEL: Record<SentenceResult["verification"]["status"], string> = {
  passed: "Verified",
  issues_found: "Issues found",
  skipped: "Verification skipped",
};

const REASON_LABEL: Record<string, string> = {
  polysemy: "multiple meanings",
  theological_nuance: "theological nuance",
  idiom: "idiom",
  unclear_source: "unclear source",
};

function providerLine(steps: StepMeta[]): string | null {
  const draft = steps[0];
  if (!draft?.provider) return null;
  const name = draft.provider === "groq" ? "Groq" : "Gemini";
  return draft.fallbackUsed ? `Translated via ${name} (fallback)` : `Translated via ${name}`;
}

function Review({ result, submitted }: { result: SentenceResult; submitted: Submitted }) {
  const { verification, flags, glossaryWarnings, notice, meta } = result;
  const provider = providerLine(meta.steps);

  return (
    <section aria-labelledby="review-heading" className="bg-surface rounded-xl shadow-card p-5 space-y-3">
      <h2 id="review-heading" className="text-lg font-bold text-primary">
        Review
      </h2>

      <p>
        Verification: <strong>{STATUS_LABEL[verification.status]}</strong>
        {verification.confidence && ` (confidence: ${verification.confidence})`}
      </p>

      {verification.revisionApplied && verification.originalDraft && (
        <details>
          <summary className="cursor-pointer">
            The translation was revised after review. Show the original draft.
          </summary>
          <p dir={dirOf(submitted.targetLang)} className="mt-2 p-3 rounded-lg bg-primary/[0.04]">
            {verification.originalDraft}
          </p>
        </details>
      )}

      {verification.issues.length > 0 && (
        <details open>
          <summary className="cursor-pointer">Issues found ({verification.issues.length})</summary>
          <ul className="mt-2 list-disc pl-5 space-y-2">
            {verification.issues.map((issue, i) => (
              <li key={i}>
                <strong>{issue.type}</strong>: {issue.explanation}
                {(issue.sourceSnippet || issue.draftSnippet) && (
                  <div className="text-sm text-text/60">
                    <span dir={dirOf(submitted.sourceLang)}>{issue.sourceSnippet}</span>
                    {" → "}
                    <span dir={dirOf(submitted.targetLang)}>{issue.draftSnippet}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {flags.length > 0 && (
        <details>
          <summary className="cursor-pointer">Flagged terms ({flags.length})</summary>
          <ul className="mt-2 list-disc pl-5 space-y-2">
            {flags.map((flag, i) => (
              <li key={i}>
                <strong dir={dirOf(submitted.sourceLang)}>{flag.term}</strong> (
                {REASON_LABEL[flag.reason] ?? flag.reason}): {flag.note}
                {flag.alternatives.length > 0 && (
                  <div className="text-sm text-text/60">
                    Alternatives:{" "}
                    <span dir={dirOf(submitted.targetLang)}>{flag.alternatives.join("، ")}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {glossaryWarnings.length > 0 && (
        <details>
          <summary className="cursor-pointer">Glossary warnings ({glossaryWarnings.length})</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {glossaryWarnings.map((w, i) => (
              <li key={i}>
                <span dir={dirOf(submitted.sourceLang)}>{w.term}</span> is usually rendered as{" "}
                <span dir={dirOf(submitted.targetLang)}>{w.expected.join(" / ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {notice && <p className="text-sm">{notice}</p>}
      {provider && <p className="text-sm text-text/60">{provider}</p>}
    </section>
  );
}

export default function SentencePage() {
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SentenceResult | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const changeSource = (code: string) => {
    setSourceLang(code);
    if (code === targetLang) {
      setTargetLang(languages.find((l) => l.code !== code)?.code ?? "en");
    }
  };

  const handleTranslate = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Please enter some text to translate.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post("/api/translate/sentence", {
        text: trimmed,
        sourceLang,
        targetLang,
      });
      setResult(response.data);
      setSubmitted({ sourceLang, targetLang });
    } catch (err: any) {
      setError(err.response?.data?.error || "Translation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 focus-ring";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Sentence Translation</h1>
        <p className="text-text/60 mt-1">
          Translate a sentence or short passage. The result is drafted, then reviewed for
          meaning and ambiguous terms.
        </p>
      </div>

      <div className="bg-surface rounded-xl shadow-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="source-lang" className="block text-sm font-medium mb-1">
              From
            </label>
            <select
              id="source-lang"
              className={fieldClass}
              value={sourceLang}
              onChange={(e) => changeSource(e.target.value)}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.native})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="target-lang" className="block text-sm font-medium mb-1">
              To
            </label>
            <select
              id="target-lang"
              className={fieldClass}
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {languages
                .filter((l) => l.code !== sourceLang)
                .map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.native})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="sentence-text" className="block text-sm font-medium mb-1">
            Text in {getLanguage(sourceLang)?.name}
          </label>
          <textarea
            id="sentence-text"
            className={`${fieldClass} min-h-[9rem] text-lg`}
            dir={dirOf(sourceLang)}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter a sentence or passage"
          />
          <p className="text-xs text-text/50 mt-1">
            {text.length}/{MAX_LENGTH} characters
          </p>
        </div>

        <button
          type="button"
          onClick={handleTranslate}
          disabled={loading || !text.trim()}
          className="w-full rounded-lg bg-primary text-white px-5 py-3 font-medium disabled:opacity-50 focus-ring"
        >
          {loading ? "Translating..." : "Translate"}
        </button>

        <div aria-live="polite">
          {error && (
            <p role="alert" className="text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>

      {result && submitted && (
        <>
          <section aria-labelledby="translation-heading" className="bg-surface rounded-xl shadow-card p-5">
            <h2 id="translation-heading" className="text-lg font-bold text-primary mb-2">
              Translation ({getLanguage(submitted.targetLang)?.name})
            </h2>
            <p
              dir={dirOf(submitted.targetLang)}
              className="text-xl leading-relaxed whitespace-pre-wrap break-words"
            >
              {result.translation}
            </p>
          </section>
          <Review result={result} submitted={submitted} />
        </>
      )}
    </div>
  );
}
