import { z } from "zod";
import { isValidLangCode } from "../services/translationService";

export const MAX_SENTENCE_LENGTH = 2000;

const langCode = z.string().refine(isValidLangCode, "must be a supported language code");

export const SentenceRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "text must not be empty")
      .max(MAX_SENTENCE_LENGTH, `text must be at most ${MAX_SENTENCE_LENGTH} characters`),
    sourceLang: langCode,
    targetLang: langCode,
  })
  .refine((v) => v.sourceLang !== v.targetLang, {
    message: "sourceLang and targetLang must be different",
    path: ["targetLang"],
  });

export type SentenceRequest = z.infer<typeof SentenceRequestSchema>;

export const DraftSchema = z.object({
  translation: z.string().trim().min(1),
});

export const VerifySchema = z.object({
  meaningPreserved: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  issues: z
    .array(
      z.object({
        type: z.enum(["mistranslation", "omission", "addition", "tone", "other"]),
        sourceSnippet: z.string().default(""),
        draftSnippet: z.string().default(""),
        explanation: z.string().default(""),
      }),
    )
    .default([]),
  suggestedRevision: z.string().nullable().default(null),
});

export const FlagSchema = z.object({
  flags: z
    .array(
      z.object({
        term: z.string(),
        reason: z.enum(["polysemy", "theological_nuance", "idiom", "unclear_source"]),
        note: z.string().default(""),
        alternatives: z.array(z.string()).default([]),
      }),
    )
    .max(10)
    .default([]),
  scriptureLikely: z.boolean().default(false),
});

export type VerifyOutput = z.infer<typeof VerifySchema>;
export type FlagOutput = z.infer<typeof FlagSchema>;
