import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";
import { extractStructuredReferral } from "@/lib/gemini";
import { getSpecialistRulesContext } from "@/lib/specialistFilter";
import { URGENCY_RANK, urgencyLabel } from "@/lib/urgency";
import type { Urgency } from "@/generated/prisma/client";

export async function GET(req: Request) {
  try {
    const session = await requireSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const urgency = searchParams.get("urgency");

    const where =
      session.role === "SPECIALIST"
        ? { specialistId: session.id }
        : { gpId: session.id };

    const referrals = await prisma.referral.findMany({
      where: {
        ...where,
        ...(urgency && urgency !== "ALL" ? { urgency: urgency as Urgency } : {}),
      },
      include: {
        specialist: { select: { id: true, name: true, email: true, specialty: true } },
        gp: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const urgencyRank = URGENCY_RANK;
  referrals.sort((a, b) => {
    const diff = (urgencyRank[a.urgency] ?? 99) - (urgencyRank[b.urgency] ?? 99);
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json({ referrals });
  } catch (e) {
    console.error("GET /api/referrals", e);
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionFromRequest(req, ["GP"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { noteId, specialistId, content, patientName } = await req.json();
    if (!specialistId) {
      return NextResponse.json({ error: "Specialist required" }, { status: 400 });
    }

    let note = noteId
      ? await prisma.note.findFirst({ where: { id: noteId, gpId: session.id } })
      : null;

    const noteContent = content || note?.content || "";
    if (!noteContent.trim()) {
      return NextResponse.json({ error: "Note or letter is empty" }, { status: 400 });
    }

    if (!note) {
      note = await prisma.note.create({
        data: {
          gpId: session.id,
          patientName: patientName || "Untitled patient",
          content: noteContent,
        },
      });
    }

    const specialist = await prisma.user.findFirst({
      where: { id: specialistId, role: "SPECIALIST" },
    });
    if (!specialist) {
      return NextResponse.json({ error: "Specialist not found" }, { status: 404 });
    }

    const { tiers, prompt } = await getSpecialistRulesContext(specialist.id);
    const extracted = await extractStructuredReferral(noteContent, prompt, tiers);

    const referral = await prisma.referral.create({
      data: {
        noteId: note.id,
        gpId: session.id,
        specialistId: specialist.id,
        noteContent,
        patientName: patientName || extracted.patientName || note.patientName,
        dob: extracted.dob,
        sex: extracted.sex,
        phone: extracted.phone,
        email: extracted.email,
        presentingComplaint: extracted.presentingComplaint,
        history: extracted.history,
        vitals: extracted.vitals,
        medications: extracted.medications,
        allergies: extracted.allergies,
        redFlags: extracted.redFlags,
        suggestedSpecialty: extracted.suggestedSpecialty || specialist.specialty || "General",
      urgency: extracted.urgency,
      seenWithinDays: extracted.seenWithinDays,
      priorityReason: extracted.priorityReason,
        aiSummary: extracted.aiSummary,
      },
    });

    await prisma.notification.create({
      data: {
        userId: specialist.id,
        referralId: referral.id,
        message: `New ${urgencyLabel(extracted.urgency)} referral from Dr. ${session.name} — ${referral.patientName}`,
      },
    });

    return NextResponse.json({ referral });
  } catch (e) {
    console.error("POST /api/referrals", e);
    const msg = e instanceof Error ? e.message : "Failed to send referral";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireSessionFromRequest(req, ["SPECIALIST"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { referralId, action } = await req.json();
  if (action !== "book") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const referral = await prisma.referral.findFirst({
    where: { id: referralId, specialistId: session.id },
  });
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Placeholder booking — marks intent only for now
  const updated = await prisma.referral.update({
    where: { id: referralId },
    data: { bookingStatus: "booked" },
  });

  return NextResponse.json({ referral: updated, message: "Booking feature coming soon" });
}
