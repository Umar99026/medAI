import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await requireSessionFromRequest(req, ["GP"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notes = await prisma.note.findMany({
      where: { gpId: session.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { referrals: true } } },
    });
    return NextResponse.json({
      notes: notes.map(({ _count, ...note }) => ({
        ...note,
        referred: _count.referrals > 0,
      })),
    });
  } catch (e) {
    console.error("GET /api/notes", e);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionFromRequest(req, ["GP"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { patientName, content, letterName } = body;

    const note = await prisma.note.create({
      data: {
        gpId: session.id,
        patientName: patientName || "Untitled patient",
        content: content || "",
        letterName: letterName || null,
      },
    });
    return NextResponse.json({ note });
  } catch (e) {
    console.error("POST /api/notes", e);
    const msg = e instanceof Error ? e.message : "Failed to save note";
    return NextResponse.json({ error: msg.includes("Unknown argument") ? "Server needs restart — run: npm run dev" : "Failed to save note" }, { status: 500 });
  }
}
