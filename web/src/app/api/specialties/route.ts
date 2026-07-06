import { NextResponse } from "next/server";
import { SPECIALTIES } from "@/lib/specialties";

export async function GET() {
  return NextResponse.json({ specialties: SPECIALTIES });
}
