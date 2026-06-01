import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// GET /api/history - List user's history
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type as string;

    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const history = await prisma.history.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.history.count({ where });

    res.json({
      history,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[HISTORY/LIST]", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// DELETE /api/history/:id - Delete a history item
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId as string;

    const history = await prisma.history.findUnique({ where: { id } });

    if (!history || history.userId !== userId) {
      throw new ApiError(404, "History item not found");
    }

    await prisma.history.delete({ where: { id } });

    res.json({ message: "History item deleted successfully" });
  } catch (error) {
    console.error("[HISTORY/DELETE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete history item" });
  }
});

// DELETE /api/history/clear/all - Clear all history
router.delete("/clear/all", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const result = await prisma.history.deleteMany({
      where: { userId },
    });

    res.json({
      message: "History cleared successfully",
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("[HISTORY/CLEAR]", error);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
