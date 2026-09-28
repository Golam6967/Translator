import { Request, Response, NextFunction } from "express";
import admin from "../lib/firebase";
import prisma from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      firebaseUid?: string;
    }
  }
}

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split("Bearer ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // Look up user in database by Firebase UID
    let user = await prisma.user.findFirst({
      where: { firebaseUid },
    });

    // If user doesn't exist in database, create them
    if (!user) {
      try {
        const userRecord = await admin.auth().getUser(firebaseUid);
        user = await prisma.user.create({
          data: {
            email: userRecord.email || "",
            firebaseUid,
            displayName:
              userRecord.displayName ||
              userRecord.email?.split("@")[0] ||
              "User",
            language: "en",
            theme: "light",
            defaultSourceLang: "en",
            fontSize: "medium",
          },
        });
        console.log("[AUTH] Created new user:", user.id);
      } catch (firebaseError: any) {
        console.error("[AUTH] Failed to create user:", firebaseError);
        return res.status(500).json({ error: "Failed to create user" });
      }
    }

    // Set both the database userId and firebaseUid
    req.userId = user.id;
    req.firebaseUid = firebaseUid;
    return next();
  } catch (error: any) {
    console.error("Token verification failed:", error);

    // Check if it's a Firebase initialization error
    if (error?.code === "app/no-app") {
      console.error("[AUTH] Firebase Admin SDK is not initialized");
      return res
        .status(500)
        .json({ error: "Authentication service is not configured" });
    }

    return res.status(401).json({ error: "Invalid token" });
  }
};

export const requireAuth = verifyFirebaseToken;
