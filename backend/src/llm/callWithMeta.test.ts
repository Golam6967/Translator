import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../middleware/errorHandler";
import { createLLMCaller } from "./callWithMeta";
import { Provider, ProviderError, ProviderName } from "./providers";

type Step = string | ProviderError;

function fakeProvider(name: ProviderName, script: Step[], configured = true) {
  const queue = [...script];
  const complete = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error(`unexpected extra call to ${name}`);
    if (next instanceof ProviderError) throw next;
    return next;
  });
  const provider: Provider = { name, isConfigured: () => configured, complete };
  return { provider, complete };
}

function setup(groq: Step[], gemini: Step[], options: { groqConfigured?: boolean; geminiConfigured?: boolean } = {}) {
  const g = fakeProvider("groq", groq, options.groqConfigured ?? true);
  const m = fakeProvider("gemini", gemini, options.geminiConfigured ?? true);
  const logs: Record<string, unknown>[] = [];
  const call = createLLMCaller({
    providers: { groq: g.provider, gemini: m.provider },
    getConfig: () => ({ timeoutMs: 1000, primary: "groq", forceFailPrimary: false, retryDelayMs: 0 }),
    log: (entry) => logs.push(entry),
  });
  return { call, groq: g, gemini: m, logs };
}

const transient = () => new ProviderError("http_503", true, 503);
const permanent = () => new ProviderError("http_401", false, 401);

afterEach(() => vi.unstubAllEnvs());

describe("createLLMCaller", () => {
  it("answers from the primary without fallback", async () => {
    const { call, gemini } = setup(["ok"], []);
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ output: "ok", provider: "groq", attempts: 1, fallbackUsed: false });
    expect(gemini.complete).not.toHaveBeenCalled();
  });

  it("retries the primary once on a transient error", async () => {
    const { call, groq } = setup([transient(), "ok"], []);
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "groq", attempts: 2, fallbackUsed: false });
    expect(groq.complete).toHaveBeenCalledTimes(2);
  });

  it("falls back after the primary fails twice", async () => {
    const { call, groq, gemini } = setup([transient(), transient()], ["from gemini"]);
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ output: "from gemini", provider: "gemini", attempts: 3, fallbackUsed: true });
    expect(groq.complete).toHaveBeenCalledTimes(2);
    expect(gemini.complete).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-transient error and falls back immediately", async () => {
    const { call, groq } = setup([permanent()], ["from gemini"]);
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "gemini", attempts: 2, fallbackUsed: true });
    expect(groq.complete).toHaveBeenCalledTimes(1);
  });

  it("gives the fallback a single attempt", async () => {
    const { call, gemini } = setup([permanent()], [transient()]);
    await expect(call({ step: "t", prompt: "hi" })).rejects.toBeInstanceOf(ApiError);
    expect(gemini.complete).toHaveBeenCalledTimes(1);
  });

  it("throws a user-safe 503 when both providers fail", async () => {
    const { call } = setup([permanent()], [permanent()]);
    const error = await call({ step: "t", prompt: "hi" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(503);
    expect(error.message).not.toMatch(/groq|gemini|401|503/i);
  });

  it("skips an unconfigured primary and uses the fallback", async () => {
    const { call, groq } = setup([], ["from gemini"], { groqConfigured: false });
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "gemini", attempts: 1, fallbackUsed: true });
    expect(groq.complete).not.toHaveBeenCalled();
  });

  it("fails cleanly when no provider is configured", async () => {
    const { call } = setup([], [], { groqConfigured: false, geminiConfigured: false });
    await expect(call({ step: "t", prompt: "hi" })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("forces the fallback path without calling the primary", async () => {
    const g = fakeProvider("groq", []);
    const m = fakeProvider("gemini", ["from gemini"]);
    const call = createLLMCaller({
      providers: { groq: g.provider, gemini: m.provider },
      getConfig: () => ({ timeoutMs: 1000, primary: "groq", forceFailPrimary: true, retryDelayMs: 0 }),
      log: () => {},
    });
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "gemini", fallbackUsed: true });
    expect(g.complete).not.toHaveBeenCalled();
  });

  it("honours LLM_PRIMARY_PROVIDER ordering", async () => {
    const g = fakeProvider("groq", ["from groq"]);
    const m = fakeProvider("gemini", ["from gemini"]);
    const call = createLLMCaller({
      providers: { groq: g.provider, gemini: m.provider },
      getConfig: () => ({ timeoutMs: 1000, primary: "gemini", forceFailPrimary: false, retryDelayMs: 0 }),
      log: () => {},
    });
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "gemini", fallbackUsed: false });
  });

  it("never logs the prompt text", async () => {
    const { call, logs } = setup([transient(), transient()], ["ok"]);
    await call({ step: "word", prompt: "SECRET-USER-TEXT" });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain("SECRET-USER-TEXT");
    expect(logs.every((l) => l.step === "word")).toBe(true);
  });

  it("reuses the caller-supplied request id in logs", async () => {
    const { call, logs } = setup(["ok"], []);
    await call({ step: "t", prompt: "hi", requestId: "req-1" });
    expect(logs.every((l) => l.requestId === "req-1")).toBe(true);
  });
});

describe("environment configuration", () => {
  it("ignores LLM_FORCE_FAIL_PRIMARY in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LLM_FORCE_FAIL_PRIMARY", "true");
    const g = fakeProvider("groq", ["from groq"]);
    const m = fakeProvider("gemini", []);
    const call = createLLMCaller({ providers: { groq: g.provider, gemini: m.provider }, log: () => {} });
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "groq", fallbackUsed: false });
  });

  it("honours LLM_FORCE_FAIL_PRIMARY outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LLM_FORCE_FAIL_PRIMARY", "true");
    const g = fakeProvider("groq", ["from groq"]);
    const m = fakeProvider("gemini", ["from gemini"]);
    const call = createLLMCaller({ providers: { groq: g.provider, gemini: m.provider }, log: () => {} });
    const result = await call({ step: "t", prompt: "hi" });
    expect(result).toMatchObject({ provider: "gemini", fallbackUsed: true });
    expect(g.complete).not.toHaveBeenCalled();
  });
});
