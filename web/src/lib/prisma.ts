import { cache } from "react";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

const getD1Prisma = cache(async () => {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  if (!env?.DB) {
    throw new Error("D1 binding DB is not configured");
  }
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
});

/** Prisma client — D1 on Cloudflare, SQLite file for local `next dev`. */
export async function getPrisma(): Promise<PrismaClient> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    if (env?.DB) return getD1Prisma();
  } catch {
    // Not on Cloudflare (plain `next dev`)
  }

  if (process.env.NODE_ENV === "development") {
    const { getLocalPrisma } = await import("./prisma-local");
    return getLocalPrisma();
  }

  throw new Error("No database configured");
}
