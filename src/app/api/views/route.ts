import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ViewSpecSchema } from "@/lib/viewspec";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const views = await prisma.savedView.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({
    views: views.map((v) => ({
      id: v.id,
      intent: v.intent,
      spec: v.spec,
      pinned: v.pinned,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

const PostSchema = z.object({
  intent: z.string().min(1).max(300),
  spec: z.unknown(),
});

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "intent and spec required" }, { status: 400 });
  }

  const spec = ViewSpecSchema.safeParse(parsed.data.spec);
  if (!spec.success) {
    return Response.json({ error: "spec failed validation" }, { status: 400 });
  }

  const view = await prisma.savedView.create({
    data: { userId: user.id, intent: parsed.data.intent, spec: spec.data },
  });

  return Response.json({
    view: {
      id: view.id,
      intent: view.intent,
      spec: view.spec,
      pinned: view.pinned,
      createdAt: view.createdAt.toISOString(),
    },
  });
}
