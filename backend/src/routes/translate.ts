import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import {
  DETAIL_FIELDS,
  DetailField,
  getSupportedLanguages,
  getWordDetails,
  isValidLangCode,
  translateWord,
} from "../services/translationService";
import { saveSentenceHistory } from "../translation/history";
import { translateSentence } from "../translation/pipeline";
import { SentenceRequestSchema } from "../translation/schemas";

const router = Router();

// GET /api/translate/languages
router.get("/languages", (req: Request, res: Response) => {
  res.status(200).json(getSupportedLanguages());
});

// POST /api/translate/word
router.post(
  "/word",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { word, fromLang, toLang } = req.body ?? {};

      if (typeof word !== "string" || !word.trim() || word.trim().length > 100) {
        throw new ApiError(400, "word must be a non-empty string of at most 100 characters");
      }
      if (typeof fromLang !== "string" || !isValidLangCode(fromLang)) {
        throw new ApiError(400, "fromLang must be a supported language code");
      }
      if (typeof toLang !== "string" || !isValidLangCode(toLang)) {
        throw new ApiError(400, "toLang must be a supported language code");
      }
      if (fromLang === toLang) {
        throw new ApiError(400, "fromLang and toLang must be different");
      }

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { word, lang, fields } = req.body ?? {};

      if (typeof word !== "string" || !word.trim() || word.trim().length > 100) {
        throw new ApiError(400, "word must be a non-empty string of at most 100 characters");
      }
      if (typeof lang !== "string" || !isValidLangCode(lang)) {
        throw new ApiError(400, "lang must be a supported language code");
      }
      if (
        !Array.isArray(fields) ||
        fields.length === 0 ||
        !fields.every((f) => DETAIL_FIELDS.includes(f))
      ) {
        throw new ApiError(400, `fields must be a non-empty array of: ${DETAIL_FIELDS.join(", ")}`);
      }

      const details = await getWordDetails(word.trim(), lang, fields as DetailField[]);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SentenceRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
          .join("; ");
        throw new ApiError(400, message);
      }

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
