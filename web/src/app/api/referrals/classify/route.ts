import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth";
import { classifySpecialtyTypes, matchSpecialty } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await requireSessionFromRequest(req, ["GP"]);
  if (!session) return NextResponse.json({ error: "Unauthorized — please sign in as a GP" }, { status: 401 });

  const { noteId, content } = await req.json();
  let noteContent = content || "";

  if (noteId) {
    const note = await prisma.note.findFirst({ where: { id: noteId, gpId: session.id } });
    if (note) noteContent = note.content || noteContent;
  }

  if (!noteContent.trim()) {
    return NextResponse.json({ error: "Note or letter is empty" }, { status: 400 });
  }

  const classification = await classifySpecialtyTypes(noteContent);
  const targetSpecs = classification.suggestedSpecialties;

  let allSpecialists = await prisma.user.findMany({
    where: { role: "SPECIALIST", isDummy: false },
    select: { id: true, name: true, email: true, specialty: true, isDummy: true },
    orderBy: { name: "asc" },
  });

  // If DB empty, tell user to seed — but still return helpful error
  if (allSpecialists.length === 0) {
    return NextResponse.json({
      error: "No specialists in database. Run: npm run db:seed",
      classification,
      specialists: [],
    }, { status: 503 });
  }

  const matched = allSpecialists.filter((s) => matchSpecialty(s.specialty, targetSpecs));
  const matchedIds = new Set(matched.map((s) => s.id));

  // Show all specialists — suggested matches first, so the GP can always pick any account
  const specialists = [
    ...matched.map((s) => ({ ...s, suggested: true })),
    ...allSpecialists.filter((s) => !matchedIds.has(s.id)).map((s) => ({ ...s, suggested: false })),
  ];

  return NextResponse.json({
    classification,
    specialists,
  });
}
