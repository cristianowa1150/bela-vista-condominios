import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  type: z.enum(["RECEITA", "DESPESA"]).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
    include: { category: true },
  });

  if (!transaction) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  return Response.json(transaction);
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const validated = updateSchema.safeParse(body);

  if (!validated.success) {
    return Response.json(
      { error: "Dados inválidos", details: validated.error.issues },
      { status: 400 }
    );
  }

  const { type, description, amount, date, categoryId, notes } = validated.data;

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(type && { type }),
      ...(description && { description }),
      ...(amount && { amount }),
      ...(date && { date: new Date(date) }),
      categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
      notes: notes !== undefined ? notes : existing.notes,
    },
    include: { category: true },
  });

  return Response.json(transaction);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });

  return Response.json({ success: true });
}
