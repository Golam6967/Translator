import { randomUUID } from "crypto";
import { ApiError } from "../middleware/errorHandler";
import {
  Provider,
  ProviderError,
  ProviderName,
  defaultProviders,
} from "./providers";

export interface LLMResult {
  output: string;
  provider: ProviderName;
  attempts: number;
  fallbackUsed: boolean;
  latencyMs: number;
}

export interface LLMCallOptions {
  step: string;
  prompt: string;
  requestId?: string;
}

export interface LLMConfig {
  timeoutMs: number;
  primary: ProviderName;
  forceFailPrimary: boolean;
  retryDelayMs: number;
}

export interface LLMDeps {
  providers: Record<ProviderName, Provider>;
  getConfig: () => LLMConfig;
  log: (entry: Record<string, unknown>) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function envConfig(): LLMConfig {
  const timeout = Number(process.env.LLM_TIMEOUT_MS);
  return {
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 20000,
    primary: process.env.LLM_PRIMARY_PROVIDER === "gemini" ? "gemini" : "groq",
    // Test-only switch; never honoured in production.
    forceFailPrimary:
      process.env.NODE_ENV !== "production" &&
      process.env.LLM_FORCE_FAIL_PRIMARY === "true",
    retryDelayMs: 300,
  };
}

// Never pass prompts, user text or keys to the logger.
const jsonLog = (entry: Record<string, unknown>) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));

export function createLLMCaller(deps: Partial<LLMDeps> = {}) {
  const providers = deps.providers ?? defaultProviders;
  const getConfig = deps.getConfig ?? envConfig;
  const log = deps.log ?? jsonLog;

  return async function callLLM(options: LLMCallOptions): Promise<LLMResult> {
    const { step, prompt } = options;
    const requestId = options.requestId ?? randomUUID();
    const config = getConfig();
    const started = Date.now();
    const secondary: ProviderName = config.primary === "groq" ? "gemini" : "groq";
    const order: ProviderName[] = [config.primary, secondary];

    let attempts = 0;

    for (const [index, name] of order.entries()) {
      const provider = providers[name];
      const isPrimary = index === 0;

      if (!provider.isConfigured() && !(isPrimary && config.forceFailPrimary)) {
        log({ event: "llm_skip", requestId, step, provider: name, reason: "not_configured" });
        continue;
      }

      // Primary gets one retry on transient errors; the fallback gets a single attempt.
      const maxAttempts = isPrimary ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts++;
        const attemptStart = Date.now();
        try {
          if (isPrimary && config.forceFailPrimary) {
            throw new ProviderError("forced_failure", false);
          }
          const output = await provider.complete(prompt, config.timeoutMs);
          const latencyMs = Date.now() - started;
          log({
            event: "llm_call",
            requestId,
            step,
            provider: name,
            attempts,
            fallbackUsed: !isPrimary,
            latencyMs,
            ok: true,
          });
          return { output, provider: name, attempts, fallbackUsed: !isPrimary, latencyMs };
        } catch (error) {
          const type = error instanceof ProviderError ? error.type : "unknown";
          const transient = error instanceof ProviderError && error.transient;
          log({
            event: "llm_call",
            requestId,
            step,
            provider: name,
            attempts,
            latencyMs: Date.now() - attemptStart,
            ok: false,
            errorType: type,
          });
          if (!transient || attempt === maxAttempts) break;
          await sleep(config.retryDelayMs);
        }
      }
    }

    log({ event: "llm_unavailable", requestId, step, attempts, latencyMs: Date.now() - started });
    throw new ApiError(503, "The translation service is temporarily unavailable. Please try again.");
  };
}

export const callLLM = createLLMCaller();
