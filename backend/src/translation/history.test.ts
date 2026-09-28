import { describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn(async (_args: unknown) => ({})) }));
vi.mock("../lib/prisma", () => ({ default: { history: { create } } }));
vi.mock("../lib/dictionary-db", () => ({ db: {}, default: {} }));

import { SENTENCE_HISTORY_TYPE, buildSentenceMetadata, saveSentenceHistory } from "./history";

const request = { text: "Patience is half of faith.", sourceLang: "en", targetLang: "ar" };

const result: any = {
  translation: "الصبر نصف الإيمان",
  verification: { status: "issues_found", confidence: "medium", issues: [], revisionApplied: true, originalDraft: "x" },
  glossaryWarnings: [{ id: "sabr", term: "patience", expected: ["صبر"] }],
  flags: [{ term: "faith", reason: "polysemy", note: "n", alternatives: [] }],
  notice: null,
  meta: {
    steps: [
      { name: "draft", provider: "groq", fallbackUsed: false, latencyMs: 10 },
      { name: "verify", provider: "gemini", fallbackUsed: true, latencyMs: 20 },
      { name: "flag", provider: "groq", fallbackUsed: false, latencyMs: 30 },
    ],
    totalLatencyMs: 55,
  },
};

describe("buildSentenceMetadata", () => {
  it("captures pipeline details for history", () => {
    expect(buildSentenceMetadata(request, result)).toEqual({
      sourceLang: "en",
      targetLang: "ar",
      sourceText: "Patience is half of faith.",
      translation: "الصبر نصف الإيمان",
      provider: "groq",
      fallbackUsed: true,
      verificationStatus: "issues_found",
      confidence: "medium",
      revisionApplied: true,
      flags: result.flags,
      glossaryWarnings: result.glossaryWarnings,
      latencyMs: 55,
    });
  });
});

describe("saveSentenceHistory", () => {
  it("stores a translate_sentence entry with the source text truncated to 500 characters", async () => {
    create.mockClear();
    await saveSentenceHistory("user-1", { ...request, text: "a".repeat(800) }, result);
    expect(create).toHaveBeenCalledTimes(1);
    const arg = (create.mock.calls[0] as any)[0].data;
    expect(arg.userId).toBe("user-1");
    expect(arg.type).toBe(SENTENCE_HISTORY_TYPE);
    expect(arg.data).toHaveLength(500);
    expect(arg.metadata.translation).toBe("الصبر نصف الإيمان");
  });
});
