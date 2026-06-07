import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECEITA_CATEGORIES, DESPESA_CATEGORIES } from "@/lib/utils";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

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
