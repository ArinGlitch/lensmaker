import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { buildPrompt } from "./prompt";
import { VIEWSPEC_JSON_SCHEMA } from "./schema";
import type { GenerateInput, GenerateResult, LLMProvider } from "./types";

const MODEL =
  process.env.BEDROCK_MODEL_ID ??
  "us.anthropic.claude-haiku-4-5-20251001-v1:0";

/**
 * Dev provider (unlimited quota). Haiku has no native responseSchema, so JSON is
 * forced via a single tool whose input schema IS the ViewSpec.
 */
export class HaikuProvider implements LLMProvider {
  readonly name = "haiku" as const;

  private client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "us-east-2",
    credentials: fromNodeProviderChain({
      profile: process.env.AWS_PROFILE ?? "bedrock",
    }),
  });

  async generateViewSpec(input: GenerateInput): Promise<GenerateResult> {
    const tool: Tool = {
      toolSpec: {
        name: "emit_viewspec",
        description: "Emit the ViewSpec describing the screen to render.",
        // Bedrock types the tool schema as DocumentType (arbitrary JSON).
        inputSchema: {
          json: VIEWSPEC_JSON_SCHEMA as unknown as Record<string, never>,
        },
      },
    };

    const started = Date.now();
    const res = await this.client.send(
      new ConverseCommand({
        modelId: MODEL,
        messages: [
          { role: "user", content: [{ text: buildPrompt(input) }] },
        ],
        inferenceConfig: { temperature: 0.2, maxTokens: 2048 },
        toolConfig: {
          tools: [tool],
          toolChoice: { tool: { name: "emit_viewspec" } },
        },
      }),
    );
    const latencyMs = Date.now() - started;

    const block = res.output?.message?.content?.find((c) => c.toolUse);
    const spec = block?.toolUse?.input ?? null;
    return { spec, raw: JSON.stringify(spec), latencyMs };
  }
}
