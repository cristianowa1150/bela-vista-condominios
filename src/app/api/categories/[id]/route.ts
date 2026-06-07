import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["RECEITA", "DESPESA"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/categories/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json();
  const validated = updateSchema.safeParse(body);

  if (!validated.success) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const category = await prisma.category.update({
    where: { id },
    data: validated.data,
  });

  return Response.json(category);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/categories/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  await prisma.category.delete({ where: { id } });

  return Response.json({ success: true });
}
