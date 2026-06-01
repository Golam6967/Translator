import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// POST /api/saved - Save a translation
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { originalText, sourceLang, translations, tags } = req.body;
    const userId = req.userId as string;

    if (!originalText || !translations) {
      throw new ApiError(400, "originalText and translations are required");
    }

    const saved = await prisma.savedTranslation.create({
      data: {
        userId,
        originalText,
        sourceLang: sourceLang || "bn",
        translations,
        tags: tags || [],
      },
    });

    res.status(201).json(saved);
  } catch (error) {
    console.error("[SAVED/CREATE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to save translation" });
  }
});

// GET /api/saved - List saved translations
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const tag = req.query.tag as string;
    const sourceLang = req.query.sourceLang as string;

    const where: any = { userId };
    if (tag) {
      where.tags = { has: tag };
    }
    if (sourceLang) {
      where.sourceLang = sourceLang;
    }

    const saved = await prisma.savedTranslation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.savedTranslation.count({ where });

    res.json({
      saved,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[SAVED/LIST]", error);
    res.status(500).json({ error: "Failed to fetch saved translations" });
  }
});

// GET /api/saved/:id - Get a single saved translation
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId as string;

    const saved = await prisma.savedTranslation.findUnique({ where: { id } });

    if (!saved || saved.userId !== userId) {
      throw new ApiError(404, "Saved translation not found");
    }

    res.json(saved);
  } catch (error) {
    console.error("[SAVED/GET]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to fetch saved translation" });
  }
});

// PUT /api/saved/:id - Update tags/metadata
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    const userId = req.userId as string;

    const saved = await prisma.savedTranslation.findUnique({ where: { id } });

    if (!saved || saved.userId !== userId) {
      throw new ApiError(404, "Saved translation not found");
    }

    const updated = await prisma.savedTranslation.update({
      where: { id },
      data: {
        tags: tags || saved.tags,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[SAVED/UPDATE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update saved translation" });
  }
});

// DELETE /api/saved/:id - Delete a saved translation
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId as string;

    const saved = await prisma.savedTranslation.findUnique({ where: { id } });

    if (!saved || saved.userId !== userId) {
      throw new ApiError(404, "Saved translation not found");
    }

    await prisma.savedTranslation.delete({ where: { id } });

    res.json({ message: "Saved translation deleted successfully" });
  } catch (error) {
    console.error("[SAVED/DELETE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete saved translation" });
  }
});

export default router;
