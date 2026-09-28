import { randomUUID } from "crypto";
import { ZodType } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { LLMCallOptions, LLMResult, callLLM as defaultCallLLM } from "../llm/callWithMeta";
import { ProviderName } from "../llm/providers";
import { GlossaryWarning, checkGlossary } from "./glossary";
import { JSON_REMINDER, draftPrompt, flagPrompt, verifyPrompt } from "./prompts";
import {
  DraftSchema,
  FlagOutput,
  FlagSchema,
  SentenceRequest,
  VerifyOutput,
  VerifySchema,
} from "./schemas";

export interface StepMeta {
  name: "draft" | "verify" | "flag";
  provider: ProviderName | null;
  fallbackUsed: boolean;
  latencyMs: number;
  attempts: number;
  status: "ok" | "skipped";
  validFirstTry: boolean;
}

export interface SentenceResult {
  translation: string;
  verification: {
    status: "passed" | "issues_found" | "skipped";
    confidence: VerifyOutput["confidence"] | null;
    issues: VerifyOutput["issues"];
    revisionApplied: boolean;
    originalDraft: string | null;
  };
  glossaryWarnings: GlossaryWarning[];
  flags: FlagOutput["flags"];
  notice: string | null;
  meta: { steps: StepMeta[]; totalLatencyMs: number };
}

export interface PipelineDeps {
  callLLM: (options: LLMCallOptions) => Promise<LLMResult>;
}

const SCRIPTURE_NOTICE =
  "This is a machine translation and not an authoritative rendering of scripture; consult a recognized translation.";

const SCRIPTURE_MARKERS = /[﴾﴿﷽]|قال رسول الله|صلى الله عليه وسلم/;

function parseJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(stripped);
}

function tryParse<T>(text: string, schema: ZodType<T, any, any>): T | null {
  try {
    const result = schema.safeParse(parseJson(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function structuredCall<T>(
  deps: PipelineDeps,
  name: StepMeta["name"],
  prompt: string,
  schema: ZodType<T, any, any>,
  requestId: string,
): Promise<{ data: T | null; meta: StepMeta }> {
  const meta: StepMeta = {
    name,
    provider: null,
    fallbackUsed: false,
    latencyMs: 0,
    attempts: 0,
    status: "skipped",
    validFirstTry: false,
  };

  for (let round = 0; round < 2; round++) {
    let result: LLMResult;
    try {
      result = await deps.callLLM({
        step: round === 0 ? name : `${name}_retry`,
        prompt: round === 0 ? prompt : prompt + JSON_REMINDER,
        requestId,
      });
    } catch (error) {
      if (name === "draft") throw error;
      return { data: null, meta };
    }

    meta.provider = result.provider;
    meta.fallbackUsed = meta.fallbackUsed || result.fallbackUsed;
    meta.latencyMs += result.latencyMs;
    meta.attempts += result.attempts;

    const data = tryParse(result.output, schema);
    if (data) {
      meta.status = "ok";
      meta.validFirstTry = round === 0;
      return { data, meta };
    }
  }

  return { data: null, meta };
}

export async function translateSentence(
  request: SentenceRequest,
  options: { requestId?: string; deps?: Partial<PipelineDeps> } = {},
): Promise<SentenceResult> {
  const deps: PipelineDeps = { callLLM: options.deps?.callLLM ?? defaultCallLLM };
  const requestId = options.requestId ?? randomUUID();
  const { text, sourceLang, targetLang } = request;
  const started = Date.now();

  const draft = await structuredCall(
    deps,
    "draft",
    draftPrompt(text, sourceLang, targetLang),
    DraftSchema,
    requestId,
  );
  if (!draft.data) {
    throw new ApiError(502, "The translation could not be produced. Please try again.");
  }
  const draftText = draft.data.translation;

  const [verify, flag] = await Promise.all([
    structuredCall(deps, "verify", verifyPrompt(text, draftText, sourceLang, targetLang), VerifySchema, requestId),
    structuredCall(deps, "flag", flagPrompt(text, draftText, sourceLang, targetLang), FlagSchema, requestId),
  ]);

  let translation = draftText;
  const verification: SentenceResult["verification"] = {
    status: "skipped",
    confidence: null,
    issues: [],
    revisionApplied: false,
    originalDraft: null,
  };

  if (verify.data) {
    const { meaningPreserved, confidence, issues, suggestedRevision } = verify.data;
    verification.status = meaningPreserved && issues.length === 0 ? "passed" : "issues_found";
    verification.confidence = confidence;
    verification.issues = issues;

    // A revision is only adopted when the reviewer is at least medium-confident; the
    // original draft is always returned so the source text is never silently rewritten.
    if (issues.length > 0 && suggestedRevision?.trim() && confidence !== "low") {
      translation = suggestedRevision.trim();
      verification.revisionApplied = true;
      verification.originalDraft = draftText;
    }
  }

  const scriptureLikely = Boolean(flag.data?.scriptureLikely) || SCRIPTURE_MARKERS.test(text);

  return {
    translation,
    verification,
    glossaryWarnings: checkGlossary({ source: text, draft: translation, sourceLang, targetLang }),
    flags: flag.data?.flags ?? [],
    notice: scriptureLikely ? SCRIPTURE_NOTICE : null,
    meta: {
      steps: [draft.meta, verify.meta, flag.meta],
      totalLatencyMs: Date.now() - started,
    },
  };
}
