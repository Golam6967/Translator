import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { translateText } from "../lib/langchain/groq-chain";
import prisma from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
const router = Router();

// POST /api/translate - Translate text to multiple languages
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { text, sourceLang, targetLangs } = req.body;
    const userId = req.userId as string;

    // Validation
    if (!text || !Array.isArray(targetLangs) || targetLangs.length === 0) {
      throw new ApiError(400, "text and targetLangs array are required");
    }

    if (text.trim().length === 0) {
      throw new ApiError(400, "Text cannot be empty");
    }

    if (text.length > 5000) {
      throw new ApiError(400, "Text cannot exceed 5000 characters");
    }

    // Translate using LangChain
    const translations = await translateText(text, targetLangs);

    // Log to history
    try {
      await prisma.history.create({
        data: {
          userId,
          type: "translate",
          data: text.substring(0, 100),
          metadata: {
            sourceLang,
            targetLangs,
            textLength: text.length,
          },
        },
      });
    } catch (historyError) {
      console.error("Failed to log history:", historyError);
      // Don't fail the request if history logging fails
    }

    res.json({
      translations,
      sourceLang,
      targetLangs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TRANSLATE]", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: "Translation failed" });
  }
});
// Inside an Express route file (e.g., src/routes/tts.ts)
import { exec } from "child_process";

router.post("/generate-audio", async (req: Request, res: Response) => {
  const { text, lang } = req.body;
  console.log(text, lang);

  if (!text || !lang) {
    return res
      .status(400)
      .json({ error: "Text and lang are required fields." });
  }

  // 1. Define a 10MB maximum buffer to prevent Node from killing the process on large audio files
  const EXEC_OPTIONS = {
    maxBuffer: 1024 * 1024 * 10,
  };

  // 2. Execute your script (ensure your python filename matches your actual file, e.g., run_pipeline.py)
  exec(
    `python D:/Translator/backend/src/speechGenerator/run_pipeline.py "${text.replace(/"/g, '\\"')}" "${lang}"`,
    EXEC_OPTIONS,
    (error, stdout, stderr) => {
      if (error) {
        console.error("[TTS ROUTE ERROR]:", stderr || error.message);
        return res
          .status(500)
          .json({ error: "TTS Pipeline crashed internally." });
      }

      const base64Data = stdout.trim();

      // Catch edge cases where Python might print an internal exception instead of the buffer string
      if (base64Data.startsWith("ERROR_FALLBACK") || !base64Data) {
        console.error("[PYTHON MACHINE ERROR]:", base64Data);
        return res
          .status(500)
          .json({ error: "Speech synthesis failed during generation." });
      }

      try {
        // 3. Convert the safe alphanumeric Base64 string directly back into a raw binary Buffer array
        const audioBuffer = Buffer.from(base64Data, "base64");

        // 4. Set headers to explicitly inform the frontend browser that a binary .wav stream is dropping in
        res.writeHead(200, {
          "Content-Type": "audio/wav",
          "Content-Length": audioBuffer.length,
          "Cache-Control": "no-cache",
        });

        // 5. Send the raw bytes down the network pipeline socket and close the response channel
        res.end(audioBuffer);
      } catch (bufError) {
        console.error("[BUFFER CONVERSION ERROR]:", bufError);
        return res.status(500).json({
          error:
            "Failed to process binary audio stream audio mapping structures.",
        });
      }
    },
  );
});

export default router;
