/**
 * Seed / re-seed the single global default QA template.
 *
 * Idempotent — safe to run repeatedly:
 *   - if no default exists, the template is created with all 20 parameters
 *   - if a default already exists, it is left alone (admin may have edited it)
 *
 * Run from `apps/api`:
 *   pnpm tsx prisma/seed/qa-template.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_QA_TEMPLATE,
  assertWeightsSumTo100,
  questionFixtureToCreate,
} from "../../src/scorecards/default-qa-template";

const prisma = new PrismaClient();

async function main() {
  assertWeightsSumTo100();

  // Look up the System Admin user — we use the bootstrap admin seeded by
  // `prisma/seed/admin.ts` as the template's `createdBy`.
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    throw new Error(
      "Bootstrap admin not found — run `prisma/seed/admin.ts` first.",
    );
  }

  const existing = await prisma.scorecardTemplate.findFirst({
    where: { isDefault: true },
  });
  if (existing) {
    console.log(
      `Default QA template already exists (id=${existing.id}, name="${existing.name}"). Leaving as-is.`,
    );
    return;
  }

  // Demote any other "active" templates so the new one is unambiguously
  // the only active QA template, per business rule #1 / #10.
  await prisma.scorecardTemplate.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const created = await prisma.scorecardTemplate.create({
    data: {
      name: DEFAULT_QA_TEMPLATE.name,
      description: DEFAULT_QA_TEMPLATE.description,
      groupName: DEFAULT_QA_TEMPLATE.groupName,
      projectId: null,
      isActive: DEFAULT_QA_TEMPLATE.isActive,
      isDefault: DEFAULT_QA_TEMPLATE.isDefault,
      version: 1,
      createdById: admin.id,
      sections: {
        create: DEFAULT_QA_TEMPLATE.sections.map((s, sIdx) => ({
          title: s.title,
          description: s.description,
          weight: s.weight,
          position: sIdx,
          questions: {
            create: s.questions.map((q, qIdx) =>
              questionFixtureToCreate(q, qIdx),
            ),
          },
        })),
      },
    },
  });

  console.log(
    `Default QA template created (id=${created.id}, name="${created.name}").`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
