/**
 * Merges the persona-authored email corpora in prisma/fixtures/personas/*.json
 * into prisma/fixtures/emails.json.
 *
 * These corpora were written by persona agents rather than a template script, so
 * voices, lengths, and buried-detail patterns vary the way real mail does. The
 * `hint` field each agent produced is kept out of the merged corpus on purpose —
 * it would leak the answer to the extraction model.
 *
 *   npx tsx scripts/merge-personas.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(process.cwd(), "prisma", "fixtures");
const PERSONAS = join(FIXTURES, "personas");

interface PersonaEmail {
  vendor: string;
  subject: string;
  body: string;
  receivedAt: string;
  hint?: string;
}

interface CorpusEmail {
  id: string;
  vendor: string;
  subject: string;
  body: string;
  receivedAt: string;
  persona: string;
}

function main() {
  if (!existsSync(PERSONAS)) {
    throw new Error(`no personas directory at ${PERSONAS}`);
  }

  const files = readdirSync(PERSONAS).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error("no persona corpora found");

  const out: CorpusEmail[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const file of files) {
    const persona = file.replace(/\.json$/, "");
    const rows = JSON.parse(
      readFileSync(join(PERSONAS, file), "utf8"),
    ) as PersonaEmail[];

    let kept = 0;
    for (const r of rows) {
      if (!r.vendor || !r.subject || !r.body || !r.receivedAt) {
        dropped += 1;
        continue;
      }
      // Include receivedAt in the key. Sender+subject alone dropped the
      // intentional duplicate-charge pair (two identical receipts days apart),
      // which is exactly the data the "is anything double-charging me?" intent
      // needs. Only a byte-identical resend is a real duplicate here.
      const key = `${r.vendor}|${r.subject}|${r.receivedAt}`.toLowerCase();
      if (seen.has(key)) {
        dropped += 1;
        continue;
      }
      if (Number.isNaN(new Date(r.receivedAt).getTime())) {
        dropped += 1;
        continue;
      }
      seen.add(key);
      out.push({
        id: `${persona[0]}${String(kept + 1).padStart(3, "0")}`,
        vendor: r.vendor,
        subject: r.subject,
        body: r.body,
        receivedAt: r.receivedAt,
        persona,
      });
      kept += 1;
    }
    console.log(`  ${persona.padEnd(14)} ${kept} kept`);
  }

  out.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  writeFileSync(
    join(FIXTURES, "emails.json"),
    `${JSON.stringify(out, null, 1)}\n`,
  );

  const months = [...new Set(out.map((e) => e.receivedAt.slice(0, 7)))].sort();
  const lens = out.map((e) => e.body.length);
  console.log(`\n  total      ${out.length} emails (${dropped} dropped)`);
  console.log(`  months     ${months.join(", ")}`);
  console.log(
    `  body chars min ${Math.min(...lens)} / avg ${Math.round(
      lens.reduce((a, b) => a + b, 0) / lens.length,
    )} / max ${Math.max(...lens)}`,
  );
  console.log(`\n  wrote prisma/fixtures/emails.json`);
  console.log(
    `  next: AWS_PROFILE=bedrock SEED_RUN_EXTRACTION=1 npx tsx prisma/seed.ts`,
  );
}

main();
