import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionFromRequest } from "@/lib/auth";
import {
  compileTierRules,
  getSpecialistTierFilter,
  normalizeTierFilter,
  type SpecialistTierFilter,
} from "@/lib/specialistFilter";

export async function GET(req: Request) {
  try {
    const session = await requireSessionFromRequest(req, ["SPECIALIST"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tiers, updatedAt } = await getSpecialistTierFilter(session.id);

    return NextResponse.json({
      filter: {
        tiers,
        updatedAt,
      },
    });
  } catch (e) {
    console.error("GET /api/specialist/filter:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load filter" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSessionFromRequest(req, ["SPECIALIST"]);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tiers } = await req.json();
    const normalized: SpecialistTierFilter = normalizeTierFilter(tiers);
    const compiled = compileTierRules(normalized);
    const tierJson = JSON.stringify(normalized);

    const filter = await prisma.specialistUrgencyFilter.upsert({
      where: { specialistId: session.id },
      create: {
        specialistId: session.id,
        tierConfig: tierJson,
        processedRules: compiled,
        instructions: compiled,
        documentText: "",
        ruleSyncNotes: "",
      },
      update: {
        tierConfig: tierJson,
        processedRules: compiled,
        instructions: compiled,
        documentText: "",
        ruleSyncNotes: "",
      },
    });

    return NextResponse.json({
      filter: {
        tiers: normalized,
        updatedAt: filter.updatedAt,
      },
    });
  } catch (e) {
    console.error("PUT /api/specialist/filter:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save filter" },
      { status: 500 }
    );
  }
}
