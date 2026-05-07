import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const existingUser = await prisma.user.findUnique({
    where: {
      username: "admin",
    },
  });

  if (existingUser) {
    console.log("Admin already exists");
    return;
  }

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash,
      name: "System Admin",
      role: "ADMIN",
    },
  });

  console.log("Admin user created");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });