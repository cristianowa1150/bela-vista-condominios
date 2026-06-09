import { prisma } from "@/lib/prisma";
import { authorize, ROLES_ADMIN } from "@/lib/authz";
import { RECEITA_CATEGORIES, DESPESA_CATEGORIES } from "@/lib/utils";

export async function POST() {
  const { error } = await authorize(ROLES_ADMIN);
  if (error) return error;

  // Seed categories
  const existing = await prisma.category.findMany();
  if (existing.length === 0) {
    await prisma.category.createMany({
      data: [
        ...RECEITA_CATEGORIES.map((c) => ({ ...c, type: "RECEITA" })),
        ...DESPESA_CATEGORIES.map((c) => ({ ...c, type: "DESPESA" })),
      ],
    });
  }

  return Response.json({ success: true });
}
