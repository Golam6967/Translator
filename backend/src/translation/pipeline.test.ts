import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/dictionary-db", () => ({ db: {}, default: {} }));

import { ApiError } from "../middleware/errorHandler";
import { translateSentence, verifyDraft } from "./pipeline";

type Reply = string | Error;

// Scripted stand-in for callLLM: each step name has a queue of replies.
function fakeLLM(script: Record<string, Reply[]>) {
  const calls: string[] = [];
  const fn = vi.fn(async (options: { step: string }) => {
    calls.push(options.step);
    const reply = script[options.step.replace(/_retry$/, "")]?.shift();
    if (reply === undefined) throw new Error(`no scripted reply for ${options.step}`);
    if (reply instanceof Error) throw reply;
    return { output: reply, provider: "groq" as const, attempts: 1, fallbackUsed: false, latencyMs: 10 };
  });
  return { fn, calls };
}

const draftJson = (translation: string) => JSON.stringify({ translation });
const verifyJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ meaningPreserved: true, confidence: "high", issues: [], suggestedRevision: null, ...over });
const flagJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ flags: [], scriptureLikely: false, ...over });

const request = { text: "Patience is half of faith.", sourceLang: "en", targetLang: "ar" };
const issue = { type: "mistranslation", sourceSnippet: "faith", draftSnippet: "x", explanation: "wrong word" };

async function run(script: Record<string, Reply[]>, req = request) {
  const { fn, calls } = fakeLLM(script);
  const result = await translateSentence(req, { deps: { callLLM: fn as any } });
  return { result, calls };
}

describe("translateSentence", () => {
  it("returns the draft with a passed verification and per-step metadata", async () => {
    const { result } = await run({
      draft: [draftJson("الصبر نصف الإيمان")],
      verify: [verifyJson()],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("الصبر نصف الإيمان");
    expect(result.verification).toMatchObject({ status: "passed", confidence: "high", revisionApplied: false });
    expect(result.meta.steps.map((s) => s.name)).toEqual(["draft", "verify", "flag"]);
    expect(result.meta.steps.every((s) => s.provider === "groq" && s.validFirstTry)).toBe(true);
    expect(result.meta.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.notice).toBeNull();
  });

  it("tolerates JSON wrapped in code fences", async () => {
    const { result } = await run({
      draft: ["```json\n" + draftJson("ترجمة") + "\n```"],
      verify: [verifyJson()],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("ترجمة");
  });

  it("skips verification, never fails, when verify returns invalid JSON twice", async () => {
    const { result, calls } = await run({
      draft: [draftJson("ترجمة")],
      verify: ["not json", "still not json"],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("ترجمة");
    expect(result.verification).toMatchObject({ status: "skipped", confidence: null, issues: [] });
    expect(calls).toContain("verify_retry");
    const verifyStep = result.meta.steps.find((s) => s.name === "verify")!;
    expect(verifyStep).toMatchObject({ status: "skipped", validFirstTry: false });
  });

  it("recovers when the retry returns valid JSON and records that it was not first try", async () => {
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: ["oops", verifyJson()],
      flag: [flagJson()],
    });
    expect(result.verification.status).toBe("passed");
    const verifyStep = result.meta.steps.find((s) => s.name === "verify")!;
    expect(verifyStep).toMatchObject({ status: "ok", validFirstTry: false });
  });

  it("returns a flag list of [] when flag output is invalid twice", async () => {
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: [verifyJson()],
      flag: ["nope", "nope"],
    });
    expect(result.flags).toEqual([]);
  });

  it("treats schema-invalid output like invalid JSON", async () => {
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: [JSON.stringify({ meaningPreserved: true, confidence: "certain" }), verifyJson()],
      flag: [flagJson()],
    });
    expect(result.verification.status).toBe("passed");
  });

  it("adopts a suggested revision at high confidence and keeps the original draft", async () => {
    const { result } = await run({
      draft: [draftJson("مسودة")],
      verify: [verifyJson({ meaningPreserved: false, issues: [issue], suggestedRevision: "منقحة" })],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("منقحة");
    expect(result.verification).toMatchObject({
      status: "issues_found",
      revisionApplied: true,
      originalDraft: "مسودة",
    });
  });

  it("adopts a suggested revision at medium confidence", async () => {
    const { result } = await run({
      draft: [draftJson("مسودة")],
      verify: [verifyJson({ confidence: "medium", meaningPreserved: false, issues: [issue], suggestedRevision: "منقحة" })],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("منقحة");
  });

  it("does not adopt a revision at low confidence but still reports the issues", async () => {
    const { result } = await run({
      draft: [draftJson("مسودة")],
      verify: [verifyJson({ confidence: "low", meaningPreserved: false, issues: [issue], suggestedRevision: "منقحة" })],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("مسودة");
    expect(result.verification).toMatchObject({ status: "issues_found", revisionApplied: false, originalDraft: null });
    expect(result.verification.issues).toHaveLength(1);
  });

  it("does not invent a revision when none is suggested", async () => {
    const { result } = await run({
      draft: [draftJson("مسودة")],
      verify: [verifyJson({ meaningPreserved: false, issues: [issue], suggestedRevision: null })],
      flag: [flagJson()],
    });
    expect(result.translation).toBe("مسودة");
    expect(result.verification.status).toBe("issues_found");
  });

  it("still succeeds when the verify and flag calls throw", async () => {
    const down = new ApiError(503, "down");
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: [down],
      flag: [down],
    });
    expect(result.translation).toBe("ترجمة");
    expect(result.verification.status).toBe("skipped");
    expect(result.flags).toEqual([]);
  });

  it("fails with a 502 when the draft is invalid twice", async () => {
    const { fn } = fakeLLM({ draft: ["bad", "bad"] });
    await expect(translateSentence(request, { deps: { callLLM: fn as any } })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("propagates a provider outage on the draft step", async () => {
    const { fn } = fakeLLM({ draft: [new ApiError(503, "down")] });
    await expect(translateSentence(request, { deps: { callLLM: fn as any } })).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("adds the scripture notice when the flag step says so", async () => {
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: [verifyJson()],
      flag: [flagJson({ scriptureLikely: true })],
    });
    expect(result.notice).toMatch(/machine translation/i);
  });

  it("adds the scripture notice from deterministic markers even if the LLM misses it", async () => {
    const { result } = await run(
      { draft: [draftJson("In the name of God")], verify: [verifyJson()], flag: [flagJson()] },
      { text: "﷽", sourceLang: "ar", targetLang: "en" },
    );
    expect(result.notice).not.toBeNull();
  });

  it("returns flags from the flag step", async () => {
    const flags = [{ term: "faith", reason: "polysemy", note: "n", alternatives: ["إيمان"] }];
    const { result } = await run({
      draft: [draftJson("ترجمة")],
      verify: [verifyJson()],
      flag: [flagJson({ flags })],
    });
    expect(result.flags).toEqual(flags);
  });

  it("reports glossary warnings against the final translation without any LLM call", async () => {
    const { result, calls } = await run({
      draft: [draftJson("العبادة")],
      verify: [verifyJson()],
      flag: [flagJson()],
    }, { text: "Prayer", sourceLang: "en", targetLang: "ar" });
    expect(result.glossaryWarnings.map((w) => w.id)).toEqual(["salah"]);
    expect(calls).toEqual(["draft", "verify", "flag"]);
  });

  it("checks the glossary against the revised translation, not the draft", async () => {
    const { result } = await run(
      {
        draft: [draftJson("العبادة")],
        verify: [verifyJson({ meaningPreserved: false, issues: [issue], suggestedRevision: "الصلاة" })],
        flag: [flagJson()],
      },
      { text: "Prayer", sourceLang: "en", targetLang: "ar" },
    );
    expect(result.glossaryWarnings).toEqual([]);
  });
});

describe("verifyDraft", () => {
  it("runs only the verify step", async () => {
    const { fn, calls } = fakeLLM({ verify: [verifyJson({ meaningPreserved: false, issues: [issue] })] });
    const { data } = await verifyDraft(request, "x", { deps: { callLLM: fn as any } });
    expect(calls).toEqual(["verify"]);
    expect(data?.issues).toHaveLength(1);
  });
});
