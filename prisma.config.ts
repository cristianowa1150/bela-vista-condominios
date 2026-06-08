/**
 * prisma.config.ts — Configuração do Prisma CLI (migrate, studio, etc.)
 *
 * Esta URL é usada SOMENTE pelo Prisma CLI (npx prisma migrate dev/deploy/studio).
 * O runtime (PrismaClient) usa o adapter em src/lib/prisma.ts.
 *
 * Em desenvolvimento sem MySQL, é possível usar SQLite:
 *   DATABASE_URL="file:./prisma/dev.db"
 *
 * Em produção (MySQL):
 *   DATABASE_URL="mysql://user:senha@host:3306/bela_vista"
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./prisma/dev.db",
  },
});
