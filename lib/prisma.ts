import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = process.env.DATABASE_URL?.trim()
  || (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("V produkcii chýba povinné DATABASE_URL pre PostgreSQL."); })()
    : "postgresql://sambike:sambike@localhost:5432/sambike_ads");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
