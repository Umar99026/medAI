import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const prisma = await getPrisma();
  const session = await requireSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    include: {
      referral: {
        select: {
          id: true,
          patientName: true,
          urgency: true,
          gp: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.id, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const prisma = await getPrisma();
  const session = await requireSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.id },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
