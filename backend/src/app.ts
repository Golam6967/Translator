import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { errorHandler } from "./middleware/errorHandler";
import { db } from "./lib/dictionary-db";

// Initialize Firebase Admin SDK first
import "./lib/firebase";

// Import routes
import authRoutes from "./routes/auth";
import translateRoutes from "./routes/translate";
import usersRoutes from "./routes/users";
import historyRoutes from "./routes/history";

const app = express();

// Middleware
app.use(cors());
// Largest legitimate body is a 2000-character sentence plus metadata.
app.use(bodyParser.json({ limit: "100kb" }));
app.use(bodyParser.urlencoded({ limit: "100kb", extended: true }));

// Health check
app.get("/health", (req, res) => {
  const health: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    const { total } = db
      .prepare(`SELECT COUNT(*) as total FROM dictionary`)
      .get() as { total: number };
    const sourceLangs = (
      db.prepare(`SELECT DISTINCT sourceLang FROM dictionary`).all() as {
        sourceLang: string;
      }[]
    ).map((r) => r.sourceLang);
    const targetCodes = (
      db.prepare(`SELECT DISTINCT targetCode FROM dictionary`).all() as {
        targetCode: string;
      }[]
    ).map((r) => r.targetCode);

    health.dictionary = {
      status: "ok",
      totalRows: total,
      sourceLangs,
      targetCodes,
    };
  } catch (error: any) {
    health.dictionary = {
      status: "error",
      message: error?.message || "Unknown error",
    };
  }

  res.json(health);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/translate", translateRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/history", historyRoutes);

// Error handling
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
