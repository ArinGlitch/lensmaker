/**
 * Pipeline A entrypoint.
 *
 * By default this reads the COMMITTED `fixtures/extracted.json` — no model call,
 * no tokens, works offline. That is deliberate: the Gemini free-tier budget is
 * tight and demo-day seeding must never depend on a network call.
 *
 * Set SEED_RUN_EXTRACTION=1 to re-run real extraction over
 * `fixtures/emails.json` through the configured provider and rewrite
 * extracted.json. Do that on Haiku (unlimited), commit the result, and the demo
 * keeps costing nothing.
 *
 *   AWS_PROFILE=bedrock SEED_RUN_EXTRACTION=1 npx tsx prisma/seed.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const FIXTURES = join(process.cwd(), "prisma", "fixtures");

interface RawEmail {
  id: string;
  vendor: string;
  subject: string;
  body: string;
  receivedAt: string;
}

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
  body: string;
}

const DEMO_EMAIL = "demo@lensmaker.app";
const DEMO_PASSWORD = "demo1234";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * The model as the INPUT module. One call per email, sequential so we never
 * hammer a rate limit. A row that fails validation is skipped loudly rather
 * than silently written with junk.
 */
async function runExtraction(): Promise<ExtractedRow[]> {
  const { getProvider } = await import("../src/lib/llm/index.js");
  const { ExtractionSchema } = await import("../src/lib/llm/extract.js");

  const provider = getProvider();
  const emails = JSON.parse(
    readFileSync(join(FIXTURES, "emails.json"), "utf8"),
  ) as RawEmail[];

  console.log(
    `[extract] ${emails.length} emails through ${provider.name} (1 call each)`,
  );

  const rows: ExtractedRow[] = [];
  let failed = 0;

  for (const [i, email] of emails.entries()) {
    const label = `${String(i + 1).padStart(2)}/${emails.length} ${email.vendor}`;
    try {
      const result = await provider.extractFields({
        vendor: email.vendor,
        subject: email.subject,
        body: email.body,
        receivedAt: email.receivedAt,
      });

      const parsed = ExtractionSchema.safeParse(result.fields);
      if (!parsed.success) {
        failed += 1;
        console.warn(
          `  ${label} — INVALID: ${parsed.error.issues
            .map((x) => x.path.join("."))
            .join(", ")}`,
        );
        continue;
      }
      const f = parsed.data;

      rows.push({
        vendor: email.vendor,
        subject: email.subject,
        category: f.category,
        amount: f.amount,
        currency: f.currency ?? "CAD",
        chargeDate:
          f.chargeInDays === null
            ? null
            : addDays(email.receivedAt, f.chargeInDays),
        deadlineDate:
          f.deadlineInDays === null
            ? null
            : addDays(email.receivedAt, f.deadlineInDays),
        receivedAt: email.receivedAt,
        summary: f.summary,
        urgency: f.urgency,
        isSuspicious: f.isSuspicious,
        riskReason: f.riskReason,
        sourceExcerpt: f.sourceExcerpt,
        body: email.body,
      });

      console.log(
        `  ${label} — ${f.category}/${f.urgency}${
          f.isSuspicious ? " ⚠ SUSPICIOUS" : ""
        } (${result.latencyMs}ms)`,
      );
    } catch (err) {
      failed += 1;
      console.warn(`  ${label} — ERROR: ${(err as Error).message}`);
    }
  }

  console.log(`[extract] ${rows.length} extracted, ${failed} failed`);
  if (rows.length === 0) {
    throw new Error("extraction produced no rows; refusing to write fixture");
  }
  return rows;
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
      `${JSON.stringify(rows, null, 1)}\n`,
    );
    console.log("[seed] rewrote fixtures/extracted.json — commit this");
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
      body: r.body ?? "",
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
