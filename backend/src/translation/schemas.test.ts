import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/dictionary-db", () => ({ db: {}, default: {} }));

import {
  DetailsRequestSchema,
  FlagSchema,
  MAX_SENTENCE_LENGTH,
  SentenceRequestSchema,
  VerifySchema,
  WordRequestSchema,
  validationMessage,
} from "./schemas";

describe("SentenceRequestSchema", () => {
  const valid = { text: "Patience is half of faith.", sourceLang: "en", targetLang: "ar" };

  it("accepts a valid request and trims the text", () => {
    const parsed = SentenceRequestSchema.parse({ ...valid, text: "  hello  " });
    expect(parsed.text).toBe("hello");
  });

  it("rejects empty text", () => {
    expect(SentenceRequestSchema.safeParse({ ...valid, text: "   " }).success).toBe(false);
  });

  it("rejects text over the limit and accepts text at the limit", () => {
    expect(
      SentenceRequestSchema.safeParse({ ...valid, text: "a".repeat(MAX_SENTENCE_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      SentenceRequestSchema.safeParse({ ...valid, text: "a".repeat(MAX_SENTENCE_LENGTH) }).success,
    ).toBe(true);
  });

  it("rejects unsupported languages", () => {
    expect(SentenceRequestSchema.safeParse({ ...valid, targetLang: "de" }).success).toBe(false);
    expect(SentenceRequestSchema.safeParse({ ...valid, sourceLang: "bn" }).success).toBe(false);
  });

  it("rejects identical source and target languages", () => {
    const result = SentenceRequestSchema.safeParse({ ...valid, targetLang: "en" });
    expect(result.success).toBe(false);
    if (!result.success) expect(validationMessage(result.error)).toContain("must be different");
  });

  it("rejects missing fields and non-string text", () => {
    expect(SentenceRequestSchema.safeParse({}).success).toBe(false);
    expect(SentenceRequestSchema.safeParse({ ...valid, text: 42 }).success).toBe(false);
  });
});

describe("WordRequestSchema and DetailsRequestSchema", () => {
  it("validates word requests", () => {
    expect(WordRequestSchema.safeParse({ word: "water", fromLang: "en", toLang: "ar" }).success).toBe(true);
    expect(WordRequestSchema.safeParse({ word: "", fromLang: "en", toLang: "ar" }).success).toBe(false);
    expect(WordRequestSchema.safeParse({ word: "a".repeat(101), fromLang: "en", toLang: "ar" }).success).toBe(false);
    expect(WordRequestSchema.safeParse({ word: "water", fromLang: "en", toLang: "en" }).success).toBe(false);
  });

  it("validates details requests", () => {
    expect(
      DetailsRequestSchema.safeParse({ word: "big", lang: "en", fields: ["synonyms", "antonyms"] }).success,
    ).toBe(true);
    expect(DetailsRequestSchema.safeParse({ word: "big", lang: "en", fields: [] }).success).toBe(false);
    expect(DetailsRequestSchema.safeParse({ word: "big", lang: "en", fields: ["meaning"] }).success).toBe(false);
    expect(DetailsRequestSchema.safeParse({ word: "big", lang: "xx", fields: ["synonyms"] }).success).toBe(false);
  });
});

describe("VerifySchema", () => {
  it("accepts a full valid payload", () => {
    const parsed = VerifySchema.parse({
      meaningPreserved: false,
      confidence: "high",
      issues: [{ type: "omission", sourceSnippet: "a", draftSnippet: "b", explanation: "c" }],
      suggestedRevision: "fixed",
    });
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.suggestedRevision).toBe("fixed");
  });

  it("applies defaults for missing issues and revision", () => {
    const parsed = VerifySchema.parse({ meaningPreserved: true, confidence: "medium" });
    expect(parsed.issues).toEqual([]);
    expect(parsed.suggestedRevision).toBeNull();
  });

  it("rejects an invalid confidence or issue type", () => {
    expect(VerifySchema.safeParse({ meaningPreserved: true, confidence: "certain" }).success).toBe(false);
    expect(
      VerifySchema.safeParse({
        meaningPreserved: true,
        confidence: "high",
        issues: [{ type: "typo", explanation: "x" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a missing meaningPreserved", () => {
    expect(VerifySchema.safeParse({ confidence: "high" }).success).toBe(false);
  });
});

describe("FlagSchema", () => {
  it("defaults to no flags and no scripture", () => {
    expect(FlagSchema.parse({})).toEqual({ flags: [], scriptureLikely: false });
  });

  it("accepts valid flags and defaults alternatives", () => {
    const parsed = FlagSchema.parse({ flags: [{ term: "x", reason: "idiom", note: "n" }] });
    expect(parsed.flags[0].alternatives).toEqual([]);
  });

  it("rejects an unknown reason and more than 10 flags", () => {
    expect(FlagSchema.safeParse({ flags: [{ term: "x", reason: "other", note: "n" }] }).success).toBe(false);
    const many = Array.from({ length: 11 }, () => ({ term: "x", reason: "idiom", note: "n" }));
    expect(FlagSchema.safeParse({ flags: many }).success).toBe(false);
  });
});
