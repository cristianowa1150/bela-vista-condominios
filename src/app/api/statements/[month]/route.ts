import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/statements/[month]">
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { month } = await ctx.params;
  const [year, m] = month.split("-").map(Number);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 0, 23, 59, 59);

  const [statement, transactions] = await Promise.all([
    prisma.accountStatement.findUnique({ where: { month } }),
    prisma.transaction.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const [rec, desp] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "RECEITA", date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "DESPESA", date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
  ]);

  return Response.json({
    statement,
    transactions,
    totals: {
      receitas: rec._sum.amount ?? 0,
      despesas: desp._sum.amount ?? 0,
      resultado: (rec._sum.amount ?? 0) - (desp._sum.amount ?? 0),
    },
  });
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/statements/[month]">
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { month } = await ctx.params;
  const body = await request.json() as { action: string; notes?: string };

  if (body.action === "close") {
    const statement = await prisma.accountStatement.update({
      where: { month },
      data: { status: "FECHADA", closedAt: new Date(), notes: body.notes ?? null },
    });
    return Response.json(statement);
  }

  if (body.action === "reopen") {
    const statement = await prisma.accountStatement.update({
      where: { month },
      data: { status: "ABERTA", closedAt: null },
    });
    return Response.json(statement);
  }

  return Response.json({ error: "Ação inválida" }, { status: 400 });
}
