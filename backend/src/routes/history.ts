import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

const VALID_TYPES = [
  "translate",
  "extract_image",
  "extract_document",
  "create_note",
];

// GET /api/history - List activity history (newest first)
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const history = await prisma.history.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ history });
  } catch (error) {
    console.error("[HISTORY:GET]", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST /api/history - Record an activity entry
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const { type, data, metadata } = req.body ?? {};

    if (typeof type !== "string" || !VALID_TYPES.includes(type)) {
      throw new ApiError(
        400,
        `type must be one of: ${VALID_TYPES.join(", ")}`,
      );
    }
    if (typeof data !== "string" || !data.trim() || data.length > 500) {
      throw new ApiError(
        400,
        "data must be a non-empty string of at most 500 characters",
      );
    }

    const entry = await prisma.history.create({
      data: {
        userId,
        type,
        data: data.trim(),
        metadata: metadata ?? undefined,
      },
    });

    res.status(201).json({ history: entry });
  } catch (error) {
    console.error("[HISTORY:POST]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to record history" });
  }
});

// DELETE /api/history/clear/all - Clear all history for the user
// (registered before /:id so "clear" isn't captured as an id)
router.delete(
  "/clear/all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId as string;

      const { count } = await prisma.history.deleteMany({ where: { userId } });

      res.json({ deleted: count });
    } catch (error) {
      console.error("[HISTORY:CLEAR]", error);
      res.status(500).json({ error: "Failed to clear history" });
    }
  },
);

// DELETE /api/history/:id - Delete a single history entry
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const { id } = req.params;

    // deleteMany so the userId filter prevents deleting other users' entries
    const { count } = await prisma.history.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new ApiError(404, "History entry not found");
    }

    res.json({ deleted: count });
  } catch (error) {
    console.error("[HISTORY:DELETE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete history entry" });
  }
});

export default router;
