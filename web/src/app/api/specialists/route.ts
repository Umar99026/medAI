import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";
import { matchSpecialty } from "@/lib/gemini";

export async function GET(req: Request) {
  const prisma = await getPrisma();
  const session = await requireSessionFromRequest(req, ["GP"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const specialtiesParam = searchParams.get("specialties");
  const suggested = specialtiesParam ? specialtiesParam.split(",").filter(Boolean) : [];

  const all = await prisma.user.findMany({
    where: { role: "SPECIALIST", isDummy: false },
    select: { id: true, name: true, email: true, specialty: true, isDummy: true },
    orderBy: { name: "asc" },
  });

  const matched = suggested.length
    ? all.filter((s) => matchSpecialty(s.specialty, suggested))
    : all;

  return NextResponse.json({
    specialists: matched.length > 0 ? matched : all,
    suggestedSpecialties: suggested,
  });
}
