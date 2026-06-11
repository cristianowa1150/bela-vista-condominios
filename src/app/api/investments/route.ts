import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, ROLES_ADMIN, round2 } from "@/lib/authz";
import { computePosition, matchContaInvestmentFlow } from "@/lib/investments";

/** Limpa todas as importações de investimentos (extratos e movimentações). */
export async function DELETE() {
  const { error } = await authorize(ROLES_ADMIN);
  if (error) return error;

  const [movements, statements] = await prisma.$transaction([
    prisma.investmentMovement.deleteMany({}),
    prisma.investmentStatement.deleteMany({}),
  ]);

  return Response.json({
    success: true,
    deleted: { statements: statements.count, movements: movements.count },
  });
}

/**
 * Dados consolidados de investimentos.
 *
 * Precedência da posição total:
 *  1. Extrato de POSIÇÃO (PDF "Posição de Renda Fixa") — carteira oficial do
 *     banco: bruto, aplicado (= bruto − rendimento) e IR/IOF na data.
 *  2. Sem posição: cálculo = aplicações(conta) − resgates + rendimento do
 *     extrato de MOVIMENTAÇÃO mais recente.
 *
 * Conferência cruzada: o principal oficial é comparado com o derivado dos
 * fluxos da conta corrente — divergência indica extrato da conta faltante.
 */
export async function GET() {
  const { error } = await authorize(ROLES_READ);
  if (error) return error;

  const [statements, dtvmFlows, latestPosicao, latestMov, contaTx] = await Promise.all([
    prisma.investmentStatement.findMany({ orderBy: { date: "asc" } }),
    prisma.investmentMovement.findMany({
      where: { snapshot: false },
      orderBy: { date: "desc" },
    }),
    prisma.investmentStatement.findFirst({
      where: { kind: "POSICAO" },
      orderBy: { date: "desc" },
      include: { movements: { where: { snapshot: true }, orderBy: { amount: "desc" } } },
    }),
    prisma.investmentStatement.findFirst({
      where: { kind: "MOVIMENTACAO" },
      orderBy: { date: "desc" },
      include: { movements: { where: { snapshot: true }, orderBy: { amount: "desc" } } },
    }),
    prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: "APLICA" } },
          { description: { contains: "aplica" } },
          { description: { contains: "Aplica" } },
          { description: { contains: "RESGATE" } },
          { description: { contains: "resgate" } },
          { description: { contains: "Resgate" } },
        ],
      },
      select: { id: true, date: true, type: true, description: true, amount: true },
      orderBy: { date: "desc" },
    }),
  ]);

  // ── Fluxos consolidados (DTVM ∪ conta corrente), com dedup entre fontes ──
  type Flow = {
    id: string;
    date: Date;
    type: "APLICACAO" | "RESGATE";
    description: string;
    amount: number;
    source: "DTVM" | "CONTA";
  };

  const flows: Flow[] = [];
  const seen = new Set<string>();
  const keyOf = (date: Date, type: string, amount: number) =>
    `${date.toISOString().slice(0, 10)}|${type}|${amount.toFixed(2)}`;

  for (const f of dtvmFlows) {
    if (f.type !== "APLICACAO" && f.type !== "RESGATE") continue;
    flows.push({
      id: f.id, date: f.date, type: f.type as Flow["type"],
      description: f.description, amount: f.amount, source: "DTVM",
    });
    seen.add(keyOf(f.date, f.type, f.amount));
  }
  for (const t of contaTx) {
    const type = matchContaInvestmentFlow(t.description, t.type);
    if (!type) continue;
    const k = keyOf(t.date, type, t.amount);
    if (seen.has(k)) continue;
    seen.add(k);
    flows.push({
      id: t.id, date: t.date, type,
      description: t.description, amount: t.amount, source: "CONTA",
    });
  }
  flows.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalAplicado = round2(
    flows.filter((f) => f.type === "APLICACAO").reduce((s, f) => s + f.amount, 0)
  );
  const totalResgatado = round2(
    flows.filter((f) => f.type === "RESGATE").reduce((s, f) => s + f.amount, 0)
  );
  const principalFluxos = round2(totalAplicado - totalResgatado);

  // ── Posição: oficial (POSICAO) tem precedência sobre o cálculo ───────────
  const usePosicao =
    latestPosicao &&
    (!latestMov || latestPosicao.date.getTime() >= latestMov.date.getTime() - 45 * 86400_000);

  let posicao: number, principal: number, rendimento: number;
  let irPrevisto: number, iofPrevisto: number;
  let fonte: "POSICAO" | "CALCULADO";
  let latest = usePosicao ? latestPosicao! : latestMov;

  if (usePosicao) {
    posicao = round2(latestPosicao!.totalValue);
    rendimento = round2(latestPosicao!.rendimento);
    principal = round2(posicao - rendimento); // = aplicado oficial do extrato
    irPrevisto = round2(latestPosicao!.irPrevisto);
    iofPrevisto = round2(latestPosicao!.iofPrevisto);
    fonte = "POSICAO";
  } else {
    rendimento = latestMov ? round2(latestMov.rendimento) : 0;
    principal = principalFluxos;
    posicao = computePosition(totalAplicado, totalResgatado, rendimento);
    irPrevisto = latestMov ? round2(latestMov.irPrevisto) : 0;
    iofPrevisto = latestMov ? round2(latestMov.iofPrevisto) : 0;
    fonte = "CALCULADO";
  }
  const liquidoEstimado = round2(posicao - irPrevisto - iofPrevisto);

  // Conferência cruzada: principal oficial × fluxos da conta
  const divergenciaPrincipal =
    fonte === "POSICAO" ? round2(principal - principalFluxos) : 0;

  // ── Evolução: posição em cada data de extrato ────────────────────────────
  const flowsAsc = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const evolution = statements.map((s) => {
    if (s.kind === "POSICAO") {
      return { date: s.date, totalValue: round2(s.totalValue), rendimento: round2(s.rendimento) };
    }
    const endOfDay = new Date(s.date);
    endOfDay.setHours(23, 59, 59, 999);
    let acc = 0;
    for (const f of flowsAsc) {
      if (f.date > endOfDay) break;
      acc += f.type === "APLICACAO" ? f.amount : -f.amount;
    }
    return {
      date: s.date,
      totalValue: computePosition(round2(acc), 0, round2(s.rendimento)),
      rendimento: round2(s.rendimento),
    };
  });

  return Response.json({
    latest: latest
      ? {
          date: latest.date,
          totalValue: posicao,
          principal,
          rendimento,
          irPrevisto,
          iofPrevisto,
          liquidoEstimado,
          fonte,
          divergenciaPrincipal,
          filename: latest.filename,
          snapshotLines: latest.movements.map((m) => ({
            type: m.type,
            description: m.description,
            amount: m.amount,
          })),
        }
      : null,
    evolution,
    totals: { aplicado: totalAplicado, resgatado: totalResgatado },
    movements: flows.slice(0, 100).map((f) => ({
      id: f.id,
      date: f.date,
      type: f.type,
      description: f.description,
      amount: f.amount,
      source: f.source,
    })),
  });
}
