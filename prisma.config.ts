/**
 * prisma.config.ts — Configuração do Prisma CLI (migrate, generate, studio…)
 *
 * A URL em DATABASE_URL determina qual banco usar:
 *   file:./prisma/dev.db  → SQLite  (desenvolvimento local)
 *   mysql://user:pass@host:3306/db → MySQL/MariaDB (produção)
 *
 * O schema.prisma contém o provider correto para o ambiente atual.
 * Ao migrar para MySQL em produção, troque o provider e execute:
 *   npm run db:generate && npm run db:deploy
 */
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

// Para SQLite, o Prisma CLI precisa de caminho absoluto
const resolvedUrl =
  rawUrl.startsWith("file:") && !path.isAbsolute(rawUrl.slice(5))
    ? `file:${path.resolve(rawUrl.slice(5))}`
    : rawUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolvedUrl,
  },
});
