import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Seeds the document types the medical module ships with.
 *
 * Every one of these is ordinary data — Command can add, rename or deactivate
 * any of them in the Form Builder, and nothing in the code depends on this
 * list. It exists only so a fresh install has somewhere to start rather than
 * an empty page and nineteen types to type out by hand.
 *
 * Idempotent: matched by name, so re-running it adds what is missing and
 * leaves anything already there — including edits — alone.
 *
 *   npm run db:seed-medical-types
 */
const TYPES: { name: string; category: string; numberPrefix: string; description: string }[] = [
  // Reports — EMS-MED
  { name: "Medical Report", category: "Report", numberPrefix: "EMS-MED", description: "General medical report." },
  { name: "Injury Report", category: "Report", numberPrefix: "EMS-MED", description: "Record of an injury, its cause and its treatment." },
  { name: "Treatment Report", category: "Report", numberPrefix: "EMS-MED", description: "Treatment given and the patient's response." },
  { name: "Hospitalization Report", category: "Report", numberPrefix: "EMS-MED", description: "Admission, course of stay and outcome." },
  { name: "Prescription / Medication Report", category: "Report", numberPrefix: "EMS-MED", description: "Medication prescribed, dosage and duration." },

  // Certificates — EMS-CERT
  { name: "Medical Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "General medical certificate." },
  { name: "Medical Fitness Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies fitness following examination." },
  { name: "Sick / Illness Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies illness and any period of unfitness." },
  { name: "Injury Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies an injury and its severity." },
  { name: "Discharge Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies discharge from care." },
  { name: "Fitness Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "General statement of fitness." },
  { name: "Work / Employment Medical Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Medical clearance for employment." },
  { name: "Return-to-Work Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Clears a patient to resume work, with any restrictions." },
  { name: "School / Activity Medical Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Clearance for schooling or an activity." },
  { name: "Fitness-to-Drive Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies fitness to hold a driving licence." },
  { name: "Treatment / Recovery Certificate", category: "Certificate", numberPrefix: "EMS-CERT", description: "Certifies completion of treatment or recovery." },

  // Evaluations — EMS-EVAL
  { name: "Psychological Evaluation", category: "Evaluation", numberPrefix: "EMS-EVAL", description: "Psychological assessment and findings." },
  { name: "Weapon License Medical Evaluation", category: "Evaluation", numberPrefix: "EMS-EVAL", description: "Medical evaluation supporting a weapon licence application." },

  { name: "Custom Medical Document", category: "Other", numberPrefix: "EMS-MED", description: "Anything the categories above don't cover." },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  let created = 0;
  let skipped = 0;

  for (const [index, type] of TYPES.entries()) {
    const existing = await prisma.medicalDocumentType.findUnique({ where: { name: type.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.medicalDocumentType.create({
      data: { ...type, order: index, active: true, createdBy: "seed" },
    });
    created++;
    console.log(`  + ${type.name}  (${type.numberPrefix})`);
  }

  console.log(`\nDocument types: ${created} added, ${skipped} already present.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
