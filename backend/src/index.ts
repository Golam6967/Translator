import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase before importing app
import "./lib/firebase";

import app from "./app";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[SERVER] Al-Maktaba Backend running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SERVER] SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("[SERVER] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[SERVER] SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("[SERVER] Server closed");
    process.exit(0);
  });
});

process.on("uncaughtException", (error) => {
  console.error("[SERVER] Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[SERVER] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
