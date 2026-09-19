import type { CatalogEntry, FieldInfo } from "@/lib/catalog";
import type { ExtractInput } from "./extract";
import type { RefineInput } from "./refine";

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

export interface ExtractResult {
  /** Deliberately `unknown` — the caller validates. */
  fields: unknown;
  raw: string;
  latencyMs: number;
}

export interface LLMProvider {
  name: "haiku" | "gemini";
  /** Pipeline B — model as OUTPUT module: intent -> ViewSpec. */
  generateViewSpec(input: GenerateInput): Promise<GenerateResult>;
  /** Pipeline A — model as INPUT module: prose -> structured row. */
  extractFields(input: ExtractInput): Promise<ExtractResult>;
  /** Pipeline B, incremental: current spec + instruction -> replacement spec. */
  refineViewSpec(input: RefineInput): Promise<GenerateResult>;
}
