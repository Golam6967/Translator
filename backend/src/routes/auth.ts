import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

// POST /api/auth/verify-token - Verify Firebase token and get user
router.post(
  "/verify-token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId as string;
      const firebaseUid = req.firebaseUid as string;

      if (!userId || !firebaseUid) {
        return res.status(401).json({ error: "Missing user information" });
      }

      // Get user info (user should already exist after middleware verification)
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      res.status(200).json({
        userId: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        message: "Token verified successfully",
      });
    } catch (error) {
      console.error("[AUTH/VERIFY-TOKEN]", error);
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to verify token" });
    }
  },
);

// GET /api/auth/me - Get current user info
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.json({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      language: user.language,
      theme: user.theme,
    });
  } catch (error) {
    console.error("[AUTH/ME]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
