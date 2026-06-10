/**
 * src/lib/prisma.ts
 *
 * Prisma 7 exige um driver adapter explícito — não há mais engine binário.
 * Este módulo detecta o DATABASE_URL e carrega o adapter correto:
 *
 *   file:./dev.db  (SQLite)  → @prisma/adapter-libsql   (desenvolvimento local)
 *   mysql://...    (MySQL)   → @prisma/adapter-mariadb  (produção Linux)
 *
 * Para trocar de SQLite para MySQL em produção:
 *   1. Altere DATABASE_URL para mysql://user:pass@host:3306/bela_vista
 *   2. Altere datasource provider em prisma/schema.prisma para "mysql"
 *   3. Execute: npm run db:generate && npm run db:deploy
 */
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function parseMysqlUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host:     u.hostname,
      port:     u.port ? Number(u.port) : 3306,
      user:     decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
      // MySQL 8 usa caching_sha2_password: em conexão local sem TLS o
      // conector precisa poder buscar a chave pública RSA do servidor
      allowPublicKeyRetrieval: true,
      connectionLimit: 5,
    };
  } catch {
    throw new Error(`[prisma] DATABASE_URL inválida: ${url}`);
  }
}

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("[prisma] DATABASE_URL não definida em .env.local");

  // ── MySQL / MariaDB ────────────────────────────────────────────────
  if (url.startsWith("mysql://") || url.startsWith("mysql:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
    const adapter = new PrismaMariaDb(parseMysqlUrl(url));
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  // ── SQLite (desenvolvimento local) ────────────────────────────────
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({ url });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  throw new Error(
    `[prisma] DATABASE_URL com protocolo desconhecido: "${url}"\n` +
    `Use "mysql://..." para MySQL/MariaDB ou "file:./caminho.db" para SQLite.`
  );
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
