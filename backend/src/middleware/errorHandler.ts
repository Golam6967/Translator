import { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  console.error("[ERROR]", err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  res.status(500).json({
    error: "Internal server error",
  });
};
