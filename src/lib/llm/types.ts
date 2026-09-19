import type { CatalogEntry, FieldInfo } from "@/lib/catalog";

export interface GenerateInput {
  intent: string;
  schemaDigest: FieldInfo[];
  catalog: CatalogEntry[];
}

export interface GenerateResult {
  /** Deliberately `unknown` — providers never validate their own output. */
  spec: unknown;
  raw: string;
  latencyMs: number;
}

export interface LLMProvider {
  name: "haiku" | "gemini";
  generateViewSpec(input: GenerateInput): Promise<GenerateResult>;
}
