import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { SPECIALTIES } from "@/lib/specialties";
import type { Role } from "@/generated/prisma/client";

export async function POST(req: Request) {
  const prisma = await getPrisma();
  const { name, email, password, role, specialty } = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    specialty?: string;
  };

  if (!name?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
  }

  if (role !== "GP" && role !== "SPECIALIST") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (role === "SPECIALIST" && !specialty) {
    return NextResponse.json({ error: "Please select your specialty" }, { status: 400 });
  }

  if (role === "SPECIALIST" && specialty && !(SPECIALTIES as readonly string[]).includes(specialty)) {
    return NextResponse.json({ error: "Invalid specialty" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password),
      role: role as Role,
      specialty: role === "SPECIALIST" ? specialty : null,
    },
  });

  const token = await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      specialty: user.specialty,
    },
  });
}
