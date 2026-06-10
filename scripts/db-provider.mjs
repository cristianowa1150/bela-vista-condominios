/**
 * Alterna o provider do Prisma entre sqlite (dev local) e mysql (produção).
 *
 * Uso:
 *   node scripts/db-provider.mjs mysql    # antes do deploy em produção
 *   node scripts/db-provider.mjs sqlite   # voltar ao desenvolvimento local
 *
 * Após alternar, rode: npx prisma generate && npx prisma db push
 */
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!["mysql", "sqlite"].includes(target)) {
  console.error("Uso: node scripts/db-provider.mjs <mysql|sqlite>");
  process.exit(1);
}

const path = new URL("../prisma/schema.prisma", import.meta.url);
const schema = readFileSync(path, "utf8");
const updated = schema.replace(
  /provider = "(sqlite|mysql)"(\s*\n\})/,
  `provider = "${target}"$2`
);

if (updated === schema && !schema.includes(`provider = "${target}"`)) {
  console.error("Não foi possível localizar o bloco datasource no schema.");
  process.exit(1);
}

writeFileSync(path, updated);
console.log(`✓ prisma/schema.prisma agora usa provider = "${target}"`);
console.log("  Próximo passo: npx prisma generate && npx prisma db push");
