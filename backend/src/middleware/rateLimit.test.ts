import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

function makeLimiter(max: number, windowMs = 60_000) {
  let time = 1_000_000;
  const limiter = createRateLimiter({ windowMs, max, now: () => time });
  const hit = (userId?: string) => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
    let error: any;
    limiter({ userId, ip: "1.2.3.4" } as any, res as any, (e?: unknown) => (error = e));
    return { headers, error };
  };
  return { hit, advance: (ms: number) => (time += ms) };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit and blocks the next with a 429", () => {
    const { hit } = makeLimiter(3);
    expect(hit("u1").error).toBeUndefined();
    expect(hit("u1").error).toBeUndefined();
    expect(hit("u1").error).toBeUndefined();
    const blocked = hit("u1");
    expect(blocked.error.statusCode).toBe(429);
    expect(blocked.headers["Retry-After"]).toBe("60");
  });

  it("reports remaining requests in headers", () => {
    const { hit } = makeLimiter(3);
    expect(hit("u1").headers["X-RateLimit-Remaining"]).toBe("2");
    expect(hit("u1").headers["X-RateLimit-Remaining"]).toBe("1");
    expect(hit("u1").headers["X-RateLimit-Limit"]).toBe("3");
  });

  it("tracks each user separately", () => {
    const { hit } = makeLimiter(1);
    expect(hit("u1").error).toBeUndefined();
    expect(hit("u1").error).toBeDefined();
    expect(hit("u2").error).toBeUndefined();
  });

  it("starts a new window after it expires", () => {
    const { hit, advance } = makeLimiter(1, 1000);
    expect(hit("u1").error).toBeUndefined();
    expect(hit("u1").error).toBeDefined();
    advance(1001);
    expect(hit("u1").error).toBeUndefined();
  });

  it("shrinks Retry-After as the window elapses", () => {
    const { hit, advance } = makeLimiter(1, 60_000);
    hit("u1");
    advance(45_000);
    expect(hit("u1").headers["Retry-After"]).toBe("15");
  });

  it("falls back to the client ip when there is no user id", () => {
    const { hit } = makeLimiter(1);
    expect(hit(undefined).error).toBeUndefined();
    expect(hit(undefined).error).toBeDefined();
  });
});
