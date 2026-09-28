import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { createRateLimiter } from "../middleware/rateLimit";
import {
  DetailField,
  getSupportedLanguages,
  getWordDetails,
  translateWord,
} from "../services/translationService";
import { saveSentenceHistory } from "../translation/history";
import { translateSentence } from "../translation/pipeline";
import {
  DetailsRequestSchema,
  SentenceRequestSchema,
  WordRequestSchema,
  validationMessage,
} from "../translation/schemas";

const router = Router();

// Word lookups fan out (one call per output language plus detail calls), so allow more.
const lookupLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const sentenceLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// GET /api/translate/languages
router.get("/languages", (req: Request, res: Response) => {
  res.status(200).json(getSupportedLanguages());
});

// POST /api/translate/word
router.post(
  "/word",
  requireAuth,
  lookupLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = WordRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new ApiError(400, validationMessage(parsed.error));

      const { word, fromLang, toLang } = parsed.data;
      const result = await translateWord(word, fromLang, toLang);

      if (!result) {
        return res.status(404).json({
          error: "Word not found in dictionary",
          word,
          fromLang,
          toLang,
        });
      }

      res.status(200).json({
        word,
        fromLang,
        toLang,
        results: result.results,
        source: result.source,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/translate/details
router.post(
  "/details",
  requireAuth,
  lookupLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = DetailsRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new ApiError(400, validationMessage(parsed.error));

      const { word, lang, fields } = parsed.data;
      const details = await getWordDetails(word, lang, fields as DetailField[]);
      if (!details) {
        throw new ApiError(503, "Word details are currently unavailable");
      }

      res.status(200).json({ word, lang, ...details });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/translate/sentence
router.post(
  "/sentence",
  requireAuth,
  sentenceLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SentenceRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new ApiError(400, validationMessage(parsed.error));

      const result = await translateSentence(parsed.data);

      // History is non-critical: a failed save must not fail the translation.
      saveSentenceHistory(req.userId as string, parsed.data, result).catch((error) =>
        console.error("[TRANSLATE:HISTORY]", error),
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
