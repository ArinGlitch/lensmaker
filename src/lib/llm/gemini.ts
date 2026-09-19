import { GoogleGenAI } from "@google/genai";
import { buildPrompt } from "./prompt";
import { VIEWSPEC_JSON_SCHEMA } from "./schema";
import type { GenerateInput, GenerateResult, LLMProvider } from "./types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

/**
 * Production provider. Uses native structured output (responseSchema), which is
 * strictly better than Haiku's tool-call workaround — this is the path we
 * optimize for. temperature 0.2 keeps layout choice near-deterministic so the
 * same question yields the same screen.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;

  private ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY ?? "",
  });

  async generateViewSpec(input: GenerateInput): Promise<GenerateResult> {
    const started = Date.now();
    const res = await this.ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(input),
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: VIEWSPEC_JSON_SCHEMA as unknown as object,
        maxOutputTokens: 2048,
      },
    });
    const latencyMs = Date.now() - started;

    const raw = res.text ?? "";
    let spec: unknown = null;
    try {
      spec = JSON.parse(raw);
    } catch {
      spec = null;
    }
    return { spec, raw, latencyMs };
  }
}
