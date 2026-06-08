import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prevent multiple PrismaClient instances during Next.js hot reload in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function parseMysqlUrl(url: string) {
  // Expects: mysql://user:password@host:port/database
  try {
    const u = new URL(url);
    return {
      host:     u.hostname,
      port:     u.port ? Number(u.port) : 3306,
      user:     decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
    };
  } catch {
    throw new Error(
      `[prisma] DATABASE_URL inválida: esperado formato mysql://user:pass@host:port/db — recebido: ${url}`
    );
  }
}

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("[prisma] DATABASE_URL não definida em .env.local");

  const cfg = parseMysqlUrl(url);
  const adapter = new PrismaMariaDb(cfg);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
