import fs from "fs";
import path from "path";
import { geminiModels, groqModel } from "../src/llm/providers";
import { translateWord } from "../src/services/translationService";
import { detectEntryIds } from "../src/translation/glossary";
import { translateSentence, verifyDraft, StepMeta } from "../src/translation/pipeline";

// Usage (from backend/): npm run eval -- [--limit N] [--force-fallback] [--out eval/REPORT.md] [--delay ms]
//   default run:      sentences, corrupted drafts, words   -> eval/results/normal.json
//   --force-fallback: sentences with the primary forced to fail -> eval/results/fallback.json
// REPORT.md is rebuilt from whatever result files exist; metrics without data say "not computed".

const args = process.argv.slice(2);
const has = (name: string) => args.includes(name);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const limit = Number(value("--limit", "0")) || Infinity;
const forceFallback = has("--force-fallback");
const delayMs = Number(value("--delay", "2500"));
const reportPath = path.resolve(value("--out", "eval/REPORT.md"));
const resultsDir = path.join(path.dirname(reportPath), "results");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const load = (file: string) => JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf-8"));

interface SentenceRecord {
  id: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
  steps: StepMeta[];
  verificationStatus?: string;
  revisionApplied?: boolean;
  flagsCount?: number;
  expectFlags?: boolean;
  scriptureNotice?: boolean;
  terms: Record<string, boolean>;
}

interface CorruptedRecord {
  id: string;
  isControl: boolean;
  skipped: boolean;
  flagged: boolean;
}

interface WordRecord {
  word: string;
  category: string;
  source: "dictionary" | "groq" | "gemini" | "not_found" | "error";
  latencyMs: number;
}

interface ResultFile {
  mode: "normal" | "fallback";
  date: string;
  models: { groq: string; gemini: string[] };
  limit: number | null;
  delayMs?: number;
  sentences: SentenceRecord[];
  corrupted: CorruptedRecord[];
  words: WordRecord[];
}

async function runSentences(): Promise<SentenceRecord[]> {
  const cases = (load("sentences.json").cases as any[]).slice(0, limit);
  const records: SentenceRecord[] = [];

  for (const [i, c] of cases.entries()) {
    const started = Date.now();
    process.stdout.write(`[sentence ${i + 1}/${cases.length}] ${c.id} ${c.sourceLang}->${c.targetLang} ... `);
    try {
      const result = await translateSentence({
        text: c.sourceText,
        sourceLang: c.sourceLang,
        targetLang: c.targetLang,
      });
      const detected = new Set(detectEntryIds(c.sourceText, c.sourceLang));
      const terms: Record<string, boolean> = {};
      for (const id of c.mustContainTerms as string[]) {
        if (detected.has(id)) terms[id] = !result.glossaryWarnings.some((w) => w.id === id);
      }
      records.push({
        id: c.id,
        ok: true,
        latencyMs: result.meta.totalLatencyMs,
        steps: result.meta.steps,
        verificationStatus: result.verification.status,
        revisionApplied: result.verification.revisionApplied,
        flagsCount: result.flags.length,
        expectFlags: Boolean(c.expectFlags),
        scriptureNotice: result.notice !== null,
        terms,
      });
      console.log(`ok ${Date.now() - started}ms`);
    } catch (error: any) {
      records.push({
        id: c.id,
        ok: false,
        error: `status ${error?.statusCode ?? "unknown"}`,
        latencyMs: Date.now() - started,
        steps: [],
        terms: {},
      });
      console.log(`FAILED (${error?.statusCode ?? error?.message})`);
    }
    await sleep(delayMs);
  }
  return records;
}

async function runCorrupted(): Promise<CorruptedRecord[]> {
  const cases = (load("corrupted.json").cases as any[]).slice(0, limit);
  const records: CorruptedRecord[] = [];

  for (const [i, c] of cases.entries()) {
    process.stdout.write(`[verify ${i + 1}/${cases.length}] ${c.id}${c.isControl ? " (control)" : ""} ... `);
    const { data } = await verifyDraft(
      { text: c.sourceText, sourceLang: c.sourceLang, targetLang: c.targetLang },
      c.draft,
    );
    const flagged = Boolean(data && (data.issues.length > 0 || !data.meaningPreserved));
    records.push({ id: c.id, isControl: Boolean(c.isControl), skipped: data === null, flagged });
    console.log(data === null ? "skipped" : flagged ? "issue reported" : "no issue");
    await sleep(delayMs);
  }
  return records;
}

async function runWords(): Promise<WordRecord[]> {
  const words = (load("words.json").words as any[]).slice(0, limit);
  const records: WordRecord[] = [];

  for (const [i, w] of words.entries()) {
    const started = Date.now();
    process.stdout.write(`[word ${i + 1}/${words.length}] ${w.word} ${w.fromLang}->${w.toLang} ... `);
    let source: WordRecord["source"];
    try {
      const result = await translateWord(w.word, w.fromLang, w.toLang);
      source = result ? result.source : "not_found";
    } catch {
      source = "error";
    }
    const latencyMs = Date.now() - started;
    records.push({ word: w.word, category: w.category, source, latencyMs });
    console.log(`${source} ${latencyMs}ms`);
    if (source !== "dictionary") await sleep(delayMs);
  }
  return records;
}

// ---------- reporting ----------

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const p95 = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.ceil(0.95 * s.length) - 1];
};
const pct = (n: number, d: number) =>
  d === 0 ? "not computed (no data)" : `${((100 * n) / d).toFixed(1)}% (${n}/${d})`;
const ms = (n: number | null) => (n === null ? "n/a" : `${(n / 1000).toFixed(2)} s`);

function readResult(mode: "normal" | "fallback"): ResultFile | null {
  const file = path.join(resultsDir, `${mode}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as ResultFile) : null;
}

function latencyRows(sentences: SentenceRecord[]): string {
  const ok = sentences.filter((s) => s.ok);
  const rows: [string, number[]][] = [
    ["draft", ok.map((s) => s.steps.find((x) => x.name === "draft")?.latencyMs).filter((x): x is number => x !== undefined)],
    ["verify", ok.map((s) => s.steps.find((x) => x.name === "verify")?.latencyMs).filter((x): x is number => x !== undefined)],
    ["flag", ok.map((s) => s.steps.find((x) => x.name === "flag")?.latencyMs).filter((x): x is number => x !== undefined)],
    ["total (draft, then verify and flag in parallel)", ok.map((s) => s.latencyMs)],
  ];
  return rows.map(([name, xs]) => `| ${name} | ${xs.length} | ${ms(median(xs))} | ${ms(p95(xs))} |`).join("\n");
}

function buildReport(normal: ResultFile | null, fallback: ResultFile | null): string {
  const lines: string[] = [];
  const meta = normal ?? fallback;
  lines.push("# Evaluation report", "");
  lines.push("> Generated by `npm run eval` from real runs. Datasets in `backend/eval/*.json` are starter sets that **need human review**; they contain no reference translations, so nothing here measures linguistic accuracy. Numbers are from small samples and should be read as such.", "");
  if (meta) {
    lines.push(`- Models: Groq \`${meta.models.groq}\`; Gemini (tried in order) ${meta.models.gemini.map((m) => `\`${m}\``).join(", ")}`);
  }
  if (normal) lines.push(`- Normal run: ${normal.date}${normal.limit ? ` (limited to ${normal.limit} cases per set)` : ""}`);
  if (fallback) lines.push(`- Forced-fallback run: ${fallback.date}${fallback.limit ? ` (limited to ${fallback.limit} cases)` : ""}`);
  lines.push("");

  // 1
  lines.push("## 1. Structured output validity (first try)", "");
  if (normal) {
    const steps = normal.sentences.filter((s) => s.ok).flatMap((s) => s.steps.filter((x) => x.name !== "draft"));
    const answered = steps.filter((x) => x.provider !== null);
    const valid = answered.filter((x) => x.validFirstTry).length;
    const unavailable = steps.length - answered.length;
    lines.push(`Verify and flag calls that returned schema-valid JSON on the first attempt: **${pct(valid, answered.length)}**.`);
    if (unavailable > 0) lines.push(`(${unavailable} step(s) excluded because no provider answered.)`);
  } else lines.push("Not computed (no normal run).");
  lines.push("");

  // 2
  lines.push("## 2. Glossary term preservation", "");
  if (normal) {
    const results = normal.sentences.filter((s) => s.ok).flatMap((s) => Object.values(s.terms));
    lines.push(`Glossary terms found in the source whose accepted rendering appeared in the final translation: **${pct(results.filter(Boolean).length, results.length)}**.`);
    lines.push("This checks surface forms from the starter glossary (needs human review), not full correctness.");
  } else lines.push("Not computed (no normal run).");
  lines.push("");

  // 3
  lines.push("## 3. Verification catch rate", "");
  if (normal && normal.corrupted.length > 0) {
    const bad = normal.corrupted.filter((c) => !c.isControl);
    const controls = normal.corrupted.filter((c) => c.isControl);
    const badAnswered = bad.filter((c) => !c.skipped);
    const controlsAnswered = controls.filter((c) => !c.skipped);
    lines.push(`Deliberately corrupted drafts where the verify step reported an issue: **${pct(badAnswered.filter((c) => c.flagged).length, badAnswered.length)}**${bad.length > badAnswered.length ? ` (${bad.length - badAnswered.length} skipped, not counted)` : ""}.`);
    lines.push(`False positives on correct control drafts: **${pct(controlsAnswered.filter((c) => c.flagged).length, controlsAnswered.length)}**.`);
  } else lines.push("Not computed (no corrupted-draft data).");
  lines.push("");

  // 4
  lines.push("## 4. Fallback reliability (primary provider forced to fail)", "");
  if (fallback) {
    const ok = fallback.sentences.filter((s) => s.ok);
    const usedGemini = ok.filter((s) => s.steps.every((x) => x.provider === "gemini")).length;
    lines.push(`Sentence requests that still succeeded via the fallback provider: **${pct(ok.length, fallback.sentences.length)}**.`);
    lines.push(`Requests where every step was answered by Gemini: ${pct(usedGemini, ok.length)}.`);
    lines.push("", "Latency under forced fallback (successful requests):", "", "| Step | n | Median | p95 |", "|---|---|---|---|", latencyRows(fallback.sentences));
  } else lines.push("Not computed (run `npm run eval -- --force-fallback`).");
  lines.push("");

  // 5
  lines.push("## 5. Latency (normal run, successful sentence requests)", "");
  if (normal) {
    const ok = normal.sentences.filter((s) => s.ok);
    lines.push(`Sentence requests: ${pct(ok.length, normal.sentences.length)} succeeded.`, "");
    lines.push("| Step | n | Median | p95 |", "|---|---|---|---|", latencyRows(normal.sentences));
    lines.push("", `Reviewer revisions adopted: ${pct(ok.filter((s) => s.revisionApplied).length, ok.length)}. Scripture notice shown: ${pct(ok.filter((s) => s.scriptureNotice).length, ok.length)}.`);
    const expected = ok.filter((s) => s.expectFlags);
    lines.push(`Cases designed to trigger flags that returned at least one flag: ${pct(expected.filter((s) => (s.flagsCount ?? 0) > 0).length, expected.length)}.`);
  } else lines.push("Not computed (no normal run).");
  lines.push("");

  // availability
  lines.push("## Provider availability (normal run)", "");
  if (normal) {
    const steps = normal.sentences.flatMap((s) => s.steps);
    const groq = steps.filter((x) => x.provider === "groq").length;
    const gemini = steps.filter((x) => x.provider === "gemini").length;
    const none = steps.filter((x) => x.provider === null).length;
    const failed = normal.sentences.filter((s) => !s.ok).length;
    lines.push(`Steps answered by Groq: ${pct(groq, steps.length)}; by Gemini (fallback): ${pct(gemini, steps.length)}; by no provider (verify/flag skipped): ${pct(none, steps.length)}.`);
    lines.push(`Sentence requests that failed outright (draft unavailable): ${pct(failed, normal.sentences.length)}.`);
    lines.push(`Pacing: ${normal.delayMs ?? "unknown"} ms between cases. Free-tier rate limits make this a property of the run's pace as well as of the pipeline.`);
  } else lines.push("Not computed (no normal run).");
  lines.push("");

  // 6
  lines.push("## 6. Word lookup: dictionary versus LLM fallback", "");
  if (normal && normal.words.length > 0) {
    const w = normal.words;
    const dict = w.filter((x) => x.source === "dictionary");
    const llm = w.filter((x) => x.source === "groq" || x.source === "gemini");
    const missing = w.filter((x) => x.source === "not_found" || x.source === "error");
    lines.push(`Words: ${w.length}. Answered by dictionary: **${pct(dict.length, w.length)}**; by LLM fallback: **${pct(llm.length, w.length)}**; unanswered: ${pct(missing.length, w.length)}.`, "");
    lines.push("| Path | n | Median latency | p95 latency |", "|---|---|---|---|");
    lines.push(`| dictionary | ${dict.length} | ${ms(median(dict.map((x) => x.latencyMs)))} | ${ms(p95(dict.map((x) => x.latencyMs)))} |`);
    lines.push(`| LLM fallback | ${llm.length} | ${ms(median(llm.map((x) => x.latencyMs)))} | ${ms(p95(llm.map((x) => x.latencyMs)))} |`);
    const cats = [...new Set(w.map((x) => x.category))];
    lines.push("", "| Category | Words | Dictionary | LLM |", "|---|---|---|---|");
    for (const c of cats) {
      const inCat = w.filter((x) => x.category === c);
      lines.push(`| ${c} | ${inCat.length} | ${inCat.filter((x) => x.source === "dictionary").length} | ${inCat.filter((x) => x.source === "groq" || x.source === "gemini").length} |`);
    }
  } else lines.push("Not computed (no word data).");
  lines.push("", "## Reproduce", "", "```bash", "cd backend", "npm run eval                        # sentences, corrupted drafts, words", "npm run eval -- --force-fallback   # fallback reliability", "```", "");
  return lines.join("\n");
}

async function main() {
  fs.mkdirSync(resultsDir, { recursive: true });

  if (forceFallback && process.env.NODE_ENV === "production") {
    throw new Error("--force-fallback is ignored in production; refusing to run.");
  }
  if (forceFallback) process.env.LLM_FORCE_FAIL_PRIMARY = "true";

  const result: ResultFile = {
    mode: forceFallback ? "fallback" : "normal",
    date: new Date().toISOString().slice(0, 10),
    models: { groq: groqModel(), gemini: geminiModels() },
    limit: Number.isFinite(limit) ? limit : null,
    delayMs,
    sentences: await runSentences(),
    corrupted: [],
    words: [],
  };

  if (!forceFallback) {
    result.corrupted = await runCorrupted();
    result.words = await runWords();
  }

  fs.writeFileSync(path.join(resultsDir, `${result.mode}.json`), JSON.stringify(result, null, 2));
  fs.writeFileSync(reportPath, buildReport(readResult("normal"), readResult("fallback")));
  console.log(`\nWrote ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
