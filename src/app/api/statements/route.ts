import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const statements = await prisma.accountStatement.findMany({
    orderBy: { month: "desc" },
  });
  return Response.json(statements);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const { month, saldoEmConta, notes } = await request.json() as {
    month: string;
    saldoEmConta: number;
    notes?: string;
  };

  if (!month) return Response.json({ error: "Mês obrigatório" }, { status: 400 });

  const [year, m] = month.split("-").map(Number);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 0, 23, 59, 59);

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

  const totalReceitas = rec._sum.amount ?? 0;
  const totalDespesas = desp._sum.amount ?? 0;
  const resultado = totalReceitas - totalDespesas;

  const statement = await prisma.accountStatement.upsert({
    where: { month },
    create: { month, saldoEmConta, totalReceitas, totalDespesas, resultado, notes: notes ?? null },
    update: { saldoEmConta, totalReceitas, totalDespesas, resultado, notes: notes ?? null },
  });

  return Response.json(statement);
}
