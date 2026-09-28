import { z } from "zod";
import { DETAIL_FIELDS, isValidLangCode } from "../services/translationService";

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

export const MAX_WORD_LENGTH = 100;

const wordText = z
  .string()
  .trim()
  .min(1, "word must not be empty")
  .max(MAX_WORD_LENGTH, `word must be at most ${MAX_WORD_LENGTH} characters`);

export const WordRequestSchema = z
  .object({ word: wordText, fromLang: langCode, toLang: langCode })
  .refine((v) => v.fromLang !== v.toLang, {
    message: "fromLang and toLang must be different",
    path: ["toLang"],
  });

export const DetailsRequestSchema = z.object({
  word: wordText,
  lang: langCode,
  fields: z
    .array(z.enum(DETAIL_FIELDS as [string, ...string[]]))
    .min(1, "fields must not be empty")
    .max(DETAIL_FIELDS.length),
});

export function validationMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

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
