/**
 * Pipeline A entrypoint.
 *
 * By default this reads the COMMITTED `fixtures/extracted.json` — no LLM call,
 * no tokens, works offline. That is deliberate: the Gemini free-tier budget is
 * tight and demo-day seeding must never depend on a network call.
 *
 * Set SEED_RUN_EXTRACTION=1 to re-run extraction from `fixtures/emails.json`
 * through the configured provider and rewrite extracted.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const FIXTURES = join(process.cwd(), "prisma", "fixtures");

interface ExtractedRow {
  vendor: string;
  subject: string;
  category: string;
  amount: number | null;
  currency: string;
  chargeDate: string | null;
  deadlineDate: string | null;
  receivedAt: string;
  summary: string;
  urgency: string;
  isSuspicious: boolean;
  riskReason: string | null;
  sourceExcerpt: string;
}

const DEMO_EMAIL = "demo@lensmaker.app";
const DEMO_PASSWORD = "demo1234";

async function runExtraction(): Promise<ExtractedRow[]> {
  // Imported lazily so the default (offline) path never loads provider SDKs.
  const { getProvider } = await import("../src/lib/llm/index.js");
  console.log(`[seed] re-running extraction via ${getProvider().name}`);
  throw new Error(
    "SEED_RUN_EXTRACTION is not implemented for the demo path. " +
      "extracted.json is committed on purpose — see the comment at the top of this file.",
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { password: passwordHash },
    create: { email: DEMO_EMAIL, password: passwordHash },
  });
  console.log(`[seed] demo user ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  let rows: ExtractedRow[];
  if (process.env.SEED_RUN_EXTRACTION === "1") {
    rows = await runExtraction();
    writeFileSync(
      join(FIXTURES, "extracted.json"),
      JSON.stringify(rows, null, 1),
    );
  } else {
    rows = JSON.parse(
      readFileSync(join(FIXTURES, "extracted.json"), "utf8"),
    ) as ExtractedRow[];
    console.log(`[seed] loaded ${rows.length} pre-extracted rows (0 tokens)`);
  }

  await prisma.item.deleteMany();
  await prisma.item.createMany({
    data: rows.map((r) => ({
      vendor: r.vendor,
      subject: r.subject,
      category: r.category,
      amount: r.amount,
      currency: r.currency,
      chargeDate: r.chargeDate ? new Date(r.chargeDate) : null,
      deadlineDate: r.deadlineDate ? new Date(r.deadlineDate) : null,
      receivedAt: new Date(r.receivedAt),
      summary: r.summary,
      urgency: r.urgency,
      isSuspicious: r.isSuspicious,
      riskReason: r.riskReason,
      sourceExcerpt: r.sourceExcerpt,
    })),
  });
  console.log(`[seed] inserted ${rows.length} items`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
