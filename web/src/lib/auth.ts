import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@/generated/prisma/client";
import { getEnvVar } from "./env";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  specialty?: string | null;
};

async function jwtSecret() {
  const value = await getEnvVar("JWT_SECRET");
  return new TextEncoder().encode(value || "dev-secret-change-in-production");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    specialty: user.specialty ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(await jwtSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, await jwtSecret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      specialty: payload.specialty ? String(payload.specialty) : null,
    };
  } catch {
    return null;
  }
}

/** Returns JWT only — no cookies (cookies are shared across localhost ports and break dual login) */
export async function createSession(user: SessionUser): Promise<string> {
  return signToken(user);
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const bearer = getBearerToken(req);
  if (!bearer) return null;
  return verifyToken(bearer);
}

export async function requireSessionFromRequest(req: Request, roles?: Role[]) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;
  return session;
}
