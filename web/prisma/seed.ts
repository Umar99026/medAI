import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../src/lib/auth";
import { SPECIALTIES } from "../src/lib/specialties";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DUMMY_SPECIALISTS = [
  { name: "Dr. James Okonkwo", specialty: "Cardiology", email: "dummy.cardio@medai.local" },
  { name: "Dr. Priya Sharma", specialty: "Dermatology", email: "dummy.derm@medai.local" },
  { name: "Dr. Michael Torres", specialty: "Orthopaedics", email: "dummy.ortho@medai.local" },
  { name: "Dr. Emily Walsh", specialty: "Psychiatry", email: "dummy.psych@medai.local" },
  { name: "Dr. Anna Kowalski", specialty: "Gastroenterology", email: "dummy.gastro@medai.local" },
  { name: "Dr. Robert Singh", specialty: "Respiratory Medicine", email: "dummy.resp@medai.local" },
  { name: "Dr. Lisa Nguyen", specialty: "Neurology", email: "dummy.neuro@medai.local" },
  { name: "Dr. David Park", specialty: "Endocrinology", email: "dummy.endo@medai.local" },
  { name: "Dr. Sophie Martin", specialty: "Rheumatology", email: "dummy.rheum@medai.local" },
  { name: "Dr. Ahmed Hassan", specialty: "Urology", email: "dummy.urology@medai.local" },
];

async function main() {
  const passwordHash = await hashPassword("password123");

  await prisma.user.upsert({
    where: { email: "gp@medai.local" },
    update: {},
    create: {
      email: "gp@medai.local",
      passwordHash,
      name: "Dr. Sarah Chen",
      role: "GP",
    },
  });

  // Real specialist accounts (can log in)
  const realSpecialists = [
    { email: "cardio@medai.local", name: "Dr. James Okonkwo (Live)", specialty: "Cardiology" },
    { email: "derm@medai.local", name: "Dr. Priya Sharma (Live)", specialty: "Dermatology" },
  ];

  for (const s of realSpecialists) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { specialty: s.specialty, isDummy: false },
      create: {
        email: s.email,
        passwordHash,
        name: s.name,
        role: "SPECIALIST",
        specialty: s.specialty,
        isDummy: false,
      },
    });
  }

  // Dummy specialists (shown in refer list, no login needed)
  for (const s of DUMMY_SPECIALISTS) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { specialty: s.specialty, isDummy: true },
      create: {
        email: s.email,
        passwordHash,
        name: s.name,
        role: "SPECIALIST",
        specialty: s.specialty,
        isDummy: true,
      },
    });
  }

  console.log("Seed complete.");
  console.log("GP: gp@medai.local / password123");
  console.log("Real specialists: cardio@medai.local, derm@medai.local");
  console.log(`Specialties available: ${SPECIALTIES.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
