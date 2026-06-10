import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ } from "@/lib/authz";

export async function GET(request: Request) {
  // Livro-caixa do condomínio é único: todos os perfis aprovados veem os
  // mesmos dados (sem filtro por usuário)
  const { error } = await authorize(ROLES_READ);
  if (error) return error;

  const { searchParams } = new URL(request.url);

  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  // legacy support
  const monthParam = searchParams.get("month");

  let startDate: Date;
  let endDate: Date;

  if (startParam && endParam) {
    startDate = new Date(startParam + "T00:00:00");
    endDate = new Date(endParam + "T23:59:59");
  } else if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const year = parseInt(monthParam.slice(0, 4));
    const month = parseInt(monthParam.slice(5, 7)) - 1;
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    // Default: last month that has any transaction data
    const latestTx = await prisma.transaction.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });
    const ref = latestTx ? latestTx.date : new Date();
    startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
    endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
  }

  // Summary for selected period
  const [receitas, despesas] = await Promise.all([
    prisma.transaction.aggregate({
      where: {type: "RECEITA", date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {type: "DESPESA", date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
  ]);

  // Period chart data: daily if ≤ 35 days, monthly otherwise
  const diffDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const groupByDay = diffDays <= 35;

  const allTx = await prisma.transaction.findMany({
    where: {date: { gte: startDate, lte: endDate } },
    select: { date: true, type: true, amount: true },
    orderBy: { date: "asc" },
  });

  let periodData: Array<{ label: string; receitas: number; despesas: number; saldo: number }>;

  if (groupByDay) {
    const map: Record<string, { receitas: number; despesas: number }> = {};
    for (const tx of allTx) {
      const d = new Date(tx.date);
      const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[isoKey]) map[isoKey] = { receitas: 0, despesas: 0 };
      if (tx.type === "RECEITA") map[isoKey].receitas += tx.amount;
      else map[isoKey].despesas += tx.amount;
      // store label separately
      (map[isoKey] as Record<string, unknown>)._label = label;
    }
    periodData = Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        label: (v as Record<string, unknown>)._label as string,
        receitas: v.receitas,
        despesas: v.despesas,
        saldo: v.receitas - v.despesas,
      }));
  } else {
    const map: Record<string, { receitas: number; despesas: number; year: number; month: number }> = {};
    for (const tx of allTx) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { receitas: 0, despesas: 0, year: d.getFullYear(), month: d.getMonth() };
      if (tx.type === "RECEITA") map[key].receitas += tx.amount;
      else map[key].despesas += tx.amount;
    }
    periodData = Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        label: new Date(v.year, v.month, 1).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        }),
        receitas: v.receitas,
        despesas: v.despesas,
        saldo: v.receitas - v.despesas,
      }));
  }

  // Category breakdown for selected period
  const categoryBreakdown = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {date: { gte: startDate, lte: endDate } },
    _sum: { amount: true },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const categoryData = categoryBreakdown
    .filter((cb) => cb.categoryId)
    .map((cb) => ({
      name: categoryMap[cb.categoryId!]?.name ?? "Sem categoria",
      color: categoryMap[cb.categoryId!]?.color ?? "#94a3b8",
      type: cb.type,
      value: cb._sum.amount ?? 0,
    }));

  // Recent transactions (last 8, no period filter)
  const recentTransactions = await prisma.transaction.findMany({
    include: { category: true },
    orderBy: { date: "desc" },
    take: 8,
  });

  // All-time balance
  const [totalReceitas, totalDespesas] = await Promise.all([
    prisma.transaction.aggregate({
      where: {type: "RECEITA" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {type: "DESPESA" },
      _sum: { amount: true },
    }),
  ]);

  // Last account statement
  const lastStatement = await prisma.accountStatement.findFirst({
    orderBy: { month: "desc" },
  });

  // Available months (for reference)
  const txDates = await prisma.transaction.findMany({
    select: { date: true },
  });
  const monthSet = new Set<string>();
  for (const { date } of txDates) {
    const d = new Date(date);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const availableMonths = Array.from(monthSet).sort();

  return Response.json({
    selectedStart: startDate.toISOString().split("T")[0],
    selectedEnd: endDate.toISOString().split("T")[0],
    availableMonths,
    groupByDay,
    currentMonth: {
      receitas: receitas._sum.amount ?? 0,
      despesas: despesas._sum.amount ?? 0,
      saldo: (receitas._sum.amount ?? 0) - (despesas._sum.amount ?? 0),
    },
    allTime: {
      receitas: totalReceitas._sum.amount ?? 0,
      despesas: totalDespesas._sum.amount ?? 0,
      saldo: (totalReceitas._sum.amount ?? 0) - (totalDespesas._sum.amount ?? 0),
    },
    saldoEmConta: lastStatement?.saldoEmConta ?? null,
    lastStatementMonth: lastStatement?.month ?? null,
    periodData,
    categoryData,
    recentTransactions,
  });
}
