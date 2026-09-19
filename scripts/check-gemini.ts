/**
 * Gemini connectivity check.
 *
 * /api/view is built to never fail — a provider error falls through to
 * buildFallbackSpec(). That is correct for the demo and useless for debugging:
 * a wrong API key and a wrong model id both look like "Gemini silently does
 * nothing". This script makes the real error visible.
 *
 *   npx tsx --env-file=.env scripts/check-gemini.ts
 */
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY ?? "";
const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

async function main() {
  console.log(`provider : ${process.env.LLM_PROVIDER ?? "(unset)"}`);
  console.log(`model    : ${model}`);
  console.log(`api key  : ${key ? `set (${key.length} chars, ...${key.slice(-4)})` : "MISSING"}`);

  if (!key) {
    console.error("\nGEMINI_API_KEY is empty. Put it in .env, then re-run.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: key });

  // Which models does this key actually have? A 404 on generateContent is
  // almost always a model id that does not exist for this key's API version.
  try {
    const names: string[] = [];
    for await (const m of await ai.models.list()) {
      if (m.name) names.push(m.name.replace(/^models\//, ""));
    }
    const flash = names.filter((n) => n.includes("flash")).slice(0, 12);
    console.log(`\nmodels visible to this key: ${names.length}`);
    if (flash.length) console.log(`flash models: ${flash.join(", ")}`);
    console.log(
      names.includes(model)
        ? `\nOK  "${model}" is available.`
        : `\nWARNING  "${model}" is NOT in this key's model list. Set GEMINI_MODEL in .env to one above.`,
    );
  } catch (err) {
    console.log(`\n(could not list models: ${err instanceof Error ? err.message : String(err)})`);
  }

  console.log(`\ncalling ${model} ...`);
  const started = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly this JSON and nothing else: {"ok":true}',
      config: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 64 },
    });
    console.log(`OK  ${Date.now() - started}ms — response: ${(res.text ?? "").trim()}`);
    console.log("\nGemini is wired up. Restart `npm run dev` so it picks up .env.");
  } catch (err) {
    console.error(`\nFAILED after ${Date.now() - started}ms`);
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      "\n401/403 -> bad or unauthorised key. 404 -> GEMINI_MODEL does not exist for this key." +
        "\n429 -> rate limited; check https://aistudio.google.com/rate-limit",
    );
    process.exit(1);
  }
}

main();
