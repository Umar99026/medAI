import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const prisma = await getPrisma();
    const session = await requireSessionFromRequest(req, ["GP"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const note = await prisma.note.findFirst({ where: { id, gpId: session.id } });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ note });
  } catch (e) {
    console.error("GET /api/notes/[id]", e);
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const prisma = await getPrisma();
    const session = await requireSessionFromRequest(req, ["GP"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      patientName?: string;
      content?: string;
      letterName?: string | null;
    };
    const { patientName, content, letterName } = body;

    const existing = await prisma.note.findFirst({ where: { id, gpId: session.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const note = await prisma.note.update({
      where: { id },
      data: {
        patientName: patientName ?? existing.patientName,
        content: content ?? existing.content,
        letterName: letterName !== undefined ? letterName : existing.letterName,
      },
    });
    return NextResponse.json({ note });
  } catch (e) {
    console.error("PATCH /api/notes/[id]", e);
    const msg = e instanceof Error ? e.message : "Failed to update note";
    return NextResponse.json(
      { error: msg.includes("Unknown argument") ? "Server needs restart — run: npm run dev" : "Failed to update note" },
      { status: 500 }
    );
  }
}
