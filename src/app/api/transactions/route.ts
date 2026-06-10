import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, ROLES_WRITE, ROLES_IMPORT } from "@/lib/authz";
import { z } from "zod";

const transactionSchema = z.object({
  type: z.enum(["RECEITA", "DESPESA"]),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { session, error } = await authorize(ROLES_READ);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const categoryId = searchParams.get("categoryId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  // Livro-caixa compartilhado: sem filtro por usuário
  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.description = { contains: search };
  }
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate + "T23:59:59");
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return Response.json({ transactions, total, page, limit });
}

export async function PATCH(request: NextRequest) {
  // Categorizar em massa faz parte da prestação de contas → OPERATOR pode
  const { session, error } = await authorize(ROLES_IMPORT);
  if (error) return error;

  const body = await request.json();
  const { ids, categoryId } = body as { ids: string[]; categoryId: string | null };

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "IDs inválidos" }, { status: 400 });
  }

  await prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { categoryId: categoryId ?? null },
  });

  return Response.json({ updated: ids.length });
}

export async function POST(request: NextRequest) {
  const { session, error } = await authorize(ROLES_WRITE);
  if (error) return error;

  const body = await request.json();
  const validated = transactionSchema.safeParse(body);

  if (!validated.success) {
    return Response.json(
      { error: "Dados inválidos", details: validated.error.issues },
      { status: 400 }
    );
  }

  const { type, description, amount, date, categoryId, notes } = validated.data;

  const transaction = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type,
      description,
      amount,
      date: new Date(date),
      categoryId: categoryId ?? null,
      notes: notes ?? null,
      source: "MANUAL",
    },
    include: { category: true },
  });

  return Response.json(transaction, { status: 201 });
}
