import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, round2 } from "@/lib/authz";
import { computePosition, matchContaInvestmentFlow } from "@/lib/investments";

/**
 * Dados consolidados de investimentos.
 *
 * Fontes:
 *  - Extratos DTVM (fotografias): rendimento acumulado, IR e IOF previstos —
 *    sempre da fotografia mais recente (acumulados; nunca somados entre si).
 *  - Fluxos (principal): aplicações/resgates dos extratos DTVM (se houver)
 *    UNIDOS aos lançamentos do extrato da conta corrente (despesas
 *    "APLICAÇÃO…" / receitas "RESGATE…"), com dedup entre as fontes.
 *
 * Posição total = aplicado − resgatado + rendimento (o LEDGERBAL do OFX DTVM
 * é o saldo da conta corrente e é ignorado — ver src/lib/investments.ts).
 */
export async function GET() {
  const { error } = await authorize(ROLES_READ);
  if (error) return error;

  const [statements, dtvmFlows, latest, contaTx] = await Promise.all([
    prisma.investmentStatement.findMany({ orderBy: { date: "asc" } }),
    prisma.investmentMovement.findMany({
      where: { snapshot: false },
      orderBy: { date: "desc" },
    }),
    prisma.investmentStatement.findFirst({
      orderBy: { date: "desc" },
      include: {
        movements: { where: { snapshot: true }, orderBy: { amount: "desc" } },
      },
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

  // Extrato DTVM tem prioridade (tem FITID)
  for (const f of dtvmFlows) {
    if (f.type !== "APLICACAO" && f.type !== "RESGATE") continue;
    flows.push({
      id: f.id, date: f.date, type: f.type as Flow["type"],
      description: f.description, amount: f.amount, source: "DTVM",
    });
    seen.add(keyOf(f.date, f.type, f.amount));
  }

  // Conta corrente: aplicações (despesa) e resgates (receita)
  for (const t of contaTx) {
    const type = matchContaInvestmentFlow(t.description, t.type);
    if (!type) continue;
    const k = keyOf(t.date, type, t.amount);
    if (seen.has(k)) continue; // mesmo fluxo já veio do extrato DTVM
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
  const principal = round2(totalAplicado - totalResgatado);

  const rendimento = latest ? round2(latest.rendimento) : 0;
  const irPrevisto = latest ? round2(latest.irPrevisto) : 0;
  const iofPrevisto = latest ? round2(latest.iofPrevisto) : 0;
  const posicao = computePosition(totalAplicado, totalResgatado, rendimento);
  const liquidoEstimado = round2(posicao - irPrevisto - iofPrevisto);

  // ── Evolução: posição em cada data de extrato ────────────────────────────
  // posição(data) = fluxos até a data + rendimento acumulado daquele extrato
  const flowsAsc = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const evolution = statements.map((s) => {
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
