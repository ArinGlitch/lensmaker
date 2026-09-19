import type {
  ExtractResult,
  GenerateInput,
  GenerateResult,
  LLMProvider,
} from "./types";
import type { ExtractInput } from "./extract";
import type { RefineInput } from "./refine";

export type { LLMProvider, GenerateInput, GenerateResult } from "./types";

/**
 * The ONLY place provider selection happens.
 *
 * Providers are loaded lazily so the unselected SDK is never bundled. This is
 * load-bearing: @google/genai pulls an optional MCP-SDK dependency that breaks
 * the Next build when eagerly imported, which would take the Haiku path down
 * with it.
 */
export function getProviderName(): "haiku" | "gemini" {
  return (process.env.LLM_PROVIDER ?? "haiku").toLowerCase() === "gemini"
    ? "gemini"
    : "haiku";
}

export function getProvider(): LLMProvider {
  const name = getProviderName();

  return {
    name,
    async generateViewSpec(input: GenerateInput): Promise<GenerateResult> {
      if (name === "gemini") {
        const { GeminiProvider } = await import("./gemini");
        return new GeminiProvider().generateViewSpec(input);
      }
      const { HaikuProvider } = await import("./haiku");
      return new HaikuProvider().generateViewSpec(input);
    },

    async refineViewSpec(input: RefineInput): Promise<GenerateResult> {
      if (name === "gemini") {
        const { GeminiProvider } = await import("./gemini");
        return new GeminiProvider().refineViewSpec(input);
      }
      const { HaikuProvider } = await import("./haiku");
      return new HaikuProvider().refineViewSpec(input);
    },

    async extractFields(input: ExtractInput): Promise<ExtractResult> {
      if (name === "gemini") {
        const { GeminiProvider } = await import("./gemini");
        return new GeminiProvider().extractFields(input);
      }
      const { HaikuProvider } = await import("./haiku");
      return new HaikuProvider().extractFields(input);
    },
  };
}
