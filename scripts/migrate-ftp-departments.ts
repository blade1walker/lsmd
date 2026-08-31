/**
 * Carries the old, single-purpose FTP interest form across to the department
 * join system.
 *
 * The FTP form is now one department among many, so this:
 *   1. creates (or updates) an "FTP" DepartmentTemplate carrying the same
 *      Paramedic rank gate and the one question the old form asked,
 *   2. copies every FTPRequest into a DepartmentApplication on it, and
 *   3. gives anyone already carrying the "FTP" roster category a membership,
 *      so the roster's FTP tick column is correct on day one.
 *
 * Idempotent: re-running matches existing rows by (department, discordId,
 * createdAt) and skips what it already copied. FTPRequest rows are left in
 * place rather than deleted — same reasoning as SopContent in the schema.
 *
 *   npm run db:migrate-ftp-departments
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FTP_MIN_RANK } from "../src/lib/constants";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const FTP_DEPARTMENT = "FTP";
const FTP_QUESTION = "Previous FTP Experience";

async function main() {
  const department = await prisma.departmentTemplate.upsert({
    where: { name: FTP_DEPARTMENT },
    create: {
      name: FTP_DEPARTMENT,
      tag: "FTP",
      color: "#3b82f6",
      description:
        "The Field Training Program. Trainers run cadet phases and sign-offs.",
      minRank: FTP_MIN_RANK,
      order: 0,
    },
    update: {},
  });
  console.log(`Department "${department.name}" ready (${department.id}).`);

  // The one question the old form asked, so migrated answers have a home.
  let question = await prisma.departmentQuestion.findFirst({
    where: { departmentId: department.id, label: FTP_QUESTION },
  });
  if (!question) {
    question = await prisma.departmentQuestion.create({
      data: {
        departmentId: department.id,
        label: FTP_QUESTION,
        type: "textarea",
        placeholder: "Describe any previous training experience...",
        required: false,
        order: 0,
      },
    });
    console.log(`Added question "${FTP_QUESTION}".`);
  }

  const requests = await prisma.fTPRequest.findMany({ orderBy: { createdAt: "asc" } });
  let copied = 0;

  for (const request of requests) {
    const existing = await prisma.departmentApplication.findFirst({
      where: {
        departmentId: department.id,
        discordId: request.discordId,
        createdAt: request.createdAt,
      },
      select: { id: true },
    });
    if (existing) continue;

    const member = request.discordId
      ? await prisma.member.findFirst({
          where: { discordId: request.discordId },
          select: { id: true },
        })
      : null;

    await prisma.departmentApplication.create({
      data: {
        departmentId: department.id,
        memberId: member?.id ?? null,
        characterName: request.characterName,
        discordId: request.discordId,
        currentRank: request.currentRole,
        answers: [
          {
            questionId: question.id,
            label: FTP_QUESTION,
            answer: request.previousExperience ?? "",
          },
        ],
        status: request.status,
        reviewedBy: request.reviewedBy,
        reviewNote: request.reviewNote,
        createdAt: request.createdAt,
      },
    });
    copied++;
  }

  console.log(`Copied ${copied} of ${requests.length} FTP request(s).`);

  // Everyone already flagged FTP on the roster becomes a department member, so
  // the new tick column matches what the category column has been showing.
  const ftpMembers = await prisma.member.findMany({
    where: { category: FTP_DEPARTMENT },
    select: { id: true, name: true },
  });
  let enrolled = 0;

  for (const member of ftpMembers) {
    const result = await prisma.departmentMembership.upsert({
      where: { departmentId_memberId: { departmentId: department.id, memberId: member.id } },
      create: { departmentId: department.id, memberId: member.id, role: "Member" },
      update: {},
      select: { createdAt: true, updatedAt: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) enrolled++;
  }

  console.log(`Enrolled ${enrolled} of ${ftpMembers.length} member(s) carrying the FTP category.`);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
