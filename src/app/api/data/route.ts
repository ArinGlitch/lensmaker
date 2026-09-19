import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SCHEMA_DIGEST } from "@/lib/catalog";
import type { Item } from "@/lib/viewspec";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.item.findMany({ orderBy: { receivedAt: "desc" } });

  const items: Item[] = rows.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    subject: r.subject,
    category: r.category,
    amount: r.amount,
    currency: r.currency,
    chargeDate: r.chargeDate?.toISOString() ?? null,
    deadlineDate: r.deadlineDate?.toISOString() ?? null,
    receivedAt: r.receivedAt.toISOString(),
    summary: r.summary,
    urgency: r.urgency,
    isSuspicious: r.isSuspicious,
    riskReason: r.riskReason,
    sourceExcerpt: r.sourceExcerpt,
    body: r.body,
  }));

  return Response.json({ items, schemaDigest: SCHEMA_DIGEST });
}
