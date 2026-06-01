import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// POST /api/notes - Create a new note
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, tags, language } = req.body;
    const userId = req.userId as string;

    if (!title || !content) {
      throw new ApiError(400, "Title and content are required");
    }

    const note = await prisma.note.create({
      data: {
        userId,
        title,
        content,
        tags: tags || [],
        language: language || "en",
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error("[NOTES/CREATE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create note" });
  }
});

// GET /api/notes - List user's notes
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.note.count({ where: { userId } });

    res.json({
      notes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[NOTES/LIST]", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /api/notes/:id - Get a single note
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId as string;

    const note = await prisma.note.findUnique({ where: { id } });

    if (!note || note.userId !== userId) {
      throw new ApiError(404, "Note not found");
    }

    res.json(note);
  } catch (error) {
    console.error("[NOTES/GET]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// PUT /api/notes/:id - Update a note (all fields)
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, tags, language } = req.body;
    const userId = req.userId as string;

    if (!title || !content) {
      throw new ApiError(400, "Title and content are required");
    }

    const note = await prisma.note.findUnique({ where: { id } });

    if (!note || note.userId !== userId) {
      throw new ApiError(404, "Note not found");
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        title,
        content,
        tags: tags || [],
        language: language || note.language,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[NOTES/UPDATE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update note" });
  }
});

// PATCH /api/notes/:id - Partial update a note
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, tags, language } = req.body;
    const userId = req.userId as string;

    const note = await prisma.note.findUnique({ where: { id } });

    if (!note || note.userId !== userId) {
      throw new ApiError(404, "Note not found");
    }

    // Build update data with only provided fields
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (tags !== undefined) updateData.tags = tags;
    if (language !== undefined) updateData.language = language;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error("[NOTES/PATCH]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update note" });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId as string;

    const note = await prisma.note.findUnique({ where: { id } });

    if (!note || note.userId !== userId) {
      throw new ApiError(404, "Note not found");
    }

    await prisma.note.delete({ where: { id } });

    res.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("[NOTES/DELETE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
