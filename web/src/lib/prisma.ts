import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/** Bump when Prisma schema changes — forces client refresh after hot reload */
const PRISMA_SCHEMA_VERSION = 2;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: number | undefined;
};

function createPrisma() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect();
  }
  const client = createPrisma();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  return client;
}

export const prisma = getPrisma();
