import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

let localPrisma: PrismaClient | undefined;

/** SQLite file client — local `next dev` only (not bundled for Workers). */
export async function getLocalPrisma(): Promise<PrismaClient> {
  if (!localPrisma) {
    const url = process.env.DATABASE_URL || "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({ url });
    localPrisma = new PrismaClient({ adapter });
  }
  return localPrisma;
}
