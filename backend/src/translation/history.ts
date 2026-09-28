import prisma from "../lib/prisma";
import type { SentenceResult } from "./pipeline";
import type { SentenceRequest } from "./schemas";

export const SENTENCE_HISTORY_TYPE = "translate_sentence";

export function buildSentenceMetadata(request: SentenceRequest, result: SentenceResult) {
  const draftStep = result.meta.steps[0];
  return {
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    sourceText: request.text,
    translation: result.translation,
    provider: draftStep.provider,
    fallbackUsed: result.meta.steps.some((s) => s.fallbackUsed),
    verificationStatus: result.verification.status,
    confidence: result.verification.confidence,
    revisionApplied: result.verification.revisionApplied,
    flags: result.flags,
    glossaryWarnings: result.glossaryWarnings,
    latencyMs: result.meta.totalLatencyMs,
  };
}

export async function saveSentenceHistory(
  userId: string,
  request: SentenceRequest,
  result: SentenceResult,
): Promise<void> {
  await prisma.history.create({
    data: {
      userId,
      type: SENTENCE_HISTORY_TYPE,
      data: request.text.slice(0, 500),
      metadata: JSON.parse(JSON.stringify(buildSentenceMetadata(request, result))),
    },
  });
}
