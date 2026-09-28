export type ProviderName = "groq" | "gemini";

export class ProviderError extends Error {
  constructor(
    public readonly type: string,
    public readonly transient: boolean,
    public readonly status?: number,
  ) {
    super(type);
    this.name = "ProviderError";
  }
}

export interface Provider {
  name: ProviderName;
  isConfigured(): boolean;
  complete(prompt: string, timeoutMs: number): Promise<string>;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ProviderError("timeout", true);
    }
    throw new ProviderError("network", true);
  }

  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500;
    throw new ProviderError(`http_${response.status}`, transient, response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ProviderError("bad_response", false);
  }
}

export const groqProvider: Provider = {
  name: "groq",
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
  async complete(prompt, timeoutMs) {
    const data = (await postJson(
      "https://api.groq.com/openai/v1/chat/completions",
      { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      {
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      },
      timeoutMs,
    )) as { choices?: { message?: { content?: string } }[] };

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("empty_response", false);
    return text;
  },
};

// Tried in order; a model that is overloaded or rate limited falls through to the next.
// All are listed as current (no shutdown date) at https://ai.google.dev/gemini-api/docs/deprecations
const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"];

function geminiModels(): string[] {
  const configured = (process.env.GEMINI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_GEMINI_MODELS;
}

export const geminiProvider: Provider = {
  name: "gemini",
  isConfigured: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  async complete(prompt, timeoutMs) {
    let lastError: ProviderError = new ProviderError("no_model_configured", false);

    for (const model of geminiModels()) {
      try {
        const data = (await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY as string },
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          },
          timeoutMs,
        )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new ProviderError("empty_response", true);
        return text;
      } catch (error) {
        if (!(error instanceof ProviderError) || !error.transient) throw error;
        lastError = error;
      }
    }

    throw lastError;
  },
};

export const defaultProviders: Record<ProviderName, Provider> = {
  groq: groqProvider,
  gemini: geminiProvider,
};
