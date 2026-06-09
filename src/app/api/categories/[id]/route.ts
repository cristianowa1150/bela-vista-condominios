import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_WRITE } from "@/lib/authz";
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
  const { error } = await authorize(ROLES_WRITE);
  if (error) return error;

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
  const { error } = await authorize(ROLES_WRITE);
  if (error) return error;

  const { id } = await ctx.params;

  await prisma.category.delete({ where: { id } });

  return Response.json({ success: true });
}
