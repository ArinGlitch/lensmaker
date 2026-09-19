/**
 * Pre-generates ViewSpecs for the scripted demo intents so the presentation
 * makes ZERO live model calls. Run once against whichever provider you will
 * demo with (cache keys include the provider name).
 *
 *   LLM_PROVIDER=gemini npx tsx scripts/warm-cache.ts
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const INTENTS = [
  "what's about to charge me?",
  "what are my hard deadlines?",
  "what am I spending most on?",
  "what's trying to scam me?",
];

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@lensmaker.app",
      password: "demo1234",
    }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";

  for (const intent of INTENTS) {
    const res = await fetch(`${BASE}/api/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ intent }),
    });
    const data = (await res.json()) as {
      source: string;
      latencyMs: number;
      spec: { blocks: { type: string }[] };
    };
    const types = data.spec.blocks.map((b) => b.type).join("+");
    console.log(
      `${data.source.padEnd(9)} ${String(data.latencyMs).padStart(5)}ms  ${types.padEnd(34)} ${intent}`,
    );
    if (data.source === "fallback") {
      console.warn("  ^ FALLBACK — investigate before demoing this intent");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
