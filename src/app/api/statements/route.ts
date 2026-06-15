import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, ROLES_IMPORT, round2 } from "@/lib/authz";
import { monthRange } from "@/lib/finance";

export async function GET() {
  const { error } = await authorize(ROLES_READ);
  if (error) return error;

  const statements = await prisma.accountStatement.findMany({
    orderBy: { month: "desc" },
  });
  return Response.json(statements);
}

export async function POST(request: NextRequest) {
  const { error } = await authorize(ROLES_IMPORT);
  if (error) return error;

  const { month, saldoEmConta, notes } = await request.json() as {
    month: string;
    saldoEmConta: number;
    notes?: string;
  };

  if (!month) return Response.json({ error: "Mês obrigatório" }, { status: 400 });

  const { startDate, endDate } = monthRange(month);

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

  const totalReceitas = round2(rec._sum.amount ?? 0);
  const totalDespesas = round2(desp._sum.amount ?? 0);
  const resultado = round2(totalReceitas - totalDespesas);

  const statement = await prisma.accountStatement.upsert({
    where: { month },
    create: { month, saldoEmConta, totalReceitas, totalDespesas, resultado, notes: notes ?? null },
    update: { saldoEmConta, totalReceitas, totalDespesas, resultado, notes: notes ?? null },
  });

  return Response.json(statement);
}
