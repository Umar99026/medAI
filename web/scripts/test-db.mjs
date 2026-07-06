import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL || "file:./dev.db";
console.log("DATABASE_URL:", url);

const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

try {
  const user = await prisma.user.findFirst({ where: { role: "GP" } });
  console.log("GP:", user?.email, user?.id);
  if (!user) {
    console.log("No GP user - run npm run db:seed");
    process.exit(1);
  }
  const note = await prisma.note.create({
    data: { gpId: user.id, patientName: "Test", content: "hello", letterName: "test.pdf" },
  });
  console.log("Created note:", note.id);
  await prisma.note.delete({ where: { id: note.id } });
  console.log("OK");
} catch (e) {
  console.error("DB ERROR:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
