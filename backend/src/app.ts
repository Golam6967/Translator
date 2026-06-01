import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { errorHandler } from "./middleware/errorHandler";

// Initialize Firebase Admin SDK first
import "./lib/firebase";

// Import routes
import authRoutes from "./routes/auth";
import translateRoutes from "./routes/translate";
import notesRoutes from "./routes/notes";
import savedRoutes from "./routes/saved";
import historyRoutes from "./routes/history";
import usersRoutes from "./routes/users";

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/translate", translateRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/users", usersRoutes);

// Error handling
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
