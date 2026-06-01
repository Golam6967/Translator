import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// GET /api/users/profile - Get user profile
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        language: true,
        theme: true,
        defaultSourceLang: true,
        fontSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.json(user);
  } catch (error) {
    console.error("[USERS/PROFILE/GET]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// PUT /api/users/profile - Update user profile
router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const { displayName, language, theme, defaultSourceLang, fontSize } =
      req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName && { displayName }),
        ...(language && { language }),
        ...(theme && { theme }),
        ...(defaultSourceLang && { defaultSourceLang }),
        ...(fontSize && { fontSize }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        language: true,
        theme: true,
        defaultSourceLang: true,
        fontSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error("[USERS/PROFILE/UPDATE]", error);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

export default router;
