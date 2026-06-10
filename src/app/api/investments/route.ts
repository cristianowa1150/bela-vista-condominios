import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, round2 } from "@/lib/authz";

/**
 * Dados consolidados de investimentos.
 *
 * - posição/rendimento/IR/IOF: SEMPRE da fotografia mais recente (extrato) —
 *   nunca soma de fotografias (são acumulados).
 * - aplicado/resgatado: soma dos fluxos deduplicados.
 */
export async function GET() {
  const { error } = await authorize(ROLES_READ);
  if (error) return error;

  const [statements, flows, latestWithLines] = await Promise.all([
    prisma.investmentStatement.findMany({ orderBy: { date: "asc" } }),
    prisma.investmentMovement.findMany({
      where: { snapshot: false },
      orderBy: { date: "desc" },
    }),
    prisma.investmentStatement.findFirst({
      orderBy: { date: "desc" },
      include: {
        movements: {
          where: { snapshot: true },
          orderBy: { amount: "desc" },
        },
      },
    }),
  ]);

  const totalAplicado = round2(
    flows.filter((f) => f.type === "APLICACAO").reduce((s, f) => s + f.amount, 0)
  );
  const totalResgatado = round2(
    flows.filter((f) => f.type === "RESGATE").reduce((s, f) => s + f.amount, 0)
  );

  const latest = latestWithLines;
  const posicao = latest ? round2(latest.totalValue) : 0;
  const irPrevisto = latest ? round2(latest.irPrevisto) : 0;
  const iofPrevisto = latest ? round2(latest.iofPrevisto) : 0;
  const rendimento = latest ? round2(latest.rendimento) : 0;
  const liquidoEstimado = round2(posicao - irPrevisto - iofPrevisto);

  return Response.json({
    latest: latest
      ? {
          date: latest.date,
          totalValue: posicao,
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
    evolution: statements.map((s) => ({
      date: s.date,
      totalValue: round2(s.totalValue),
      rendimento: round2(s.rendimento),
    })),
    totals: { aplicado: totalAplicado, resgatado: totalResgatado },
    movements: flows.slice(0, 100).map((f) => ({
      id: f.id,
      date: f.date,
      type: f.type,
      description: f.description,
      amount: f.amount,
    })),
  });
}
