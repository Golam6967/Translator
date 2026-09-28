import { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./errorHandler";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface Window {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 10_000;

// Fixed-window, in-memory limiter keyed by the authenticated user id. State is per
// process and resets on restart, so it does not protect a multi-instance deployment.
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const { windowMs, max } = options;
  const now = options.now ?? Date.now;
  const windows = new Map<string, Window>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.userId ?? req.ip ?? "anonymous";
    const time = now();

    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [k, w] of windows) if (w.resetAt <= time) windows.delete(k);
    }

    let entry = windows.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      windows.set(key, entry);
    }
    entry.count++;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return next(new ApiError(429, `Too many requests. Try again in ${retryAfter}s.`));
    }

    next();
  };
}
