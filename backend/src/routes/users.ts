import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

const VALID_FONT_SIZES = ["small", "medium", "large"];
const VALID_THEMES = ["light", "dark"];
const VALID_UI_LANGUAGES = ["en", "bn"];
const VALID_SOURCE_LANGS = ["en", "ar", "fa", "ur", "tr"];

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.json({
      displayName: user.displayName,
      email: user.email,
      language: user.language,
      theme: user.theme,
      defaultSourceLang: user.defaultSourceLang,
      fontSize: user.fontSize,
    });
  } catch (error) {
    console.error("[USERS/PROFILE:GET]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const { displayName, language, theme, defaultSourceLang, fontSize } = req.body;

    if (language !== undefined && !VALID_UI_LANGUAGES.includes(language)) {
      throw new ApiError(400, `Invalid language, must be one of: ${VALID_UI_LANGUAGES.join(", ")}`);
    }
    if (theme !== undefined && !VALID_THEMES.includes(theme)) {
      throw new ApiError(400, `Invalid theme, must be one of: ${VALID_THEMES.join(", ")}`);
    }
    if (defaultSourceLang !== undefined && !VALID_SOURCE_LANGS.includes(defaultSourceLang)) {
      throw new ApiError(400, `Invalid defaultSourceLang, must be one of: ${VALID_SOURCE_LANGS.join(", ")}`);
    }
    if (fontSize !== undefined && !VALID_FONT_SIZES.includes(fontSize)) {
      throw new ApiError(400, `Invalid fontSize, must be one of: ${VALID_FONT_SIZES.join(", ")}`);
    }
    if (displayName !== undefined && typeof displayName !== "string") {
      throw new ApiError(400, "Invalid displayName");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(language !== undefined && { language }),
        ...(theme !== undefined && { theme }),
        ...(defaultSourceLang !== undefined && { defaultSourceLang }),
        ...(fontSize !== undefined && { fontSize }),
      },
    });

    res.json({
      displayName: user.displayName,
      email: user.email,
      language: user.language,
      theme: user.theme,
      defaultSourceLang: user.defaultSourceLang,
      fontSize: user.fontSize,
    });
  } catch (error) {
    console.error("[USERS/PROFILE:PUT]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
