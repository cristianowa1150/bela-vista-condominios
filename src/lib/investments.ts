/**
 * Lógica financeira do módulo de investimentos — pura e testável.
 *
 * Princípios (precisão de prestação de contas):
 *  - Linhas "ATÉ ESTA DATA" / "PREVISÃO" são FOTOGRAFIAS acumuladas na data
 *    do extrato: nunca se somam entre importações. Cada extrato substitui a
 *    fotografia da sua data; o dashboard usa sempre a mais recente.
 *  - APLICAÇÃO e RESGATE são FLUXOS: somam-se, com deduplicação por FITID
 *    (e por chave data|tipo|valor|descrição quando não há FITID).
 *  - "Total investido" (posição) vem do LEDGERBAL do extrato — nunca de soma
 *    de fluxos, que não captura rendimento.
 */
import { round2 } from "@/lib/money";

export type InvestmentType =
  | "APLICACAO"
  | "RESGATE"
  | "RENDIMENTO"
  | "IR_PREVISTO"
  | "IOF_PREVISTO"
  | "OUTRO";

export interface ClassifiedEntry {
  date: string;
  type: InvestmentType;
  description: string;
  amount: number; // sempre positivo
  fitid: string | null;
  snapshot: boolean; // true = acumulado "até esta data" (não é fluxo)
}

/** Normaliza acentos para comparação robusta de MEMOs */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/**
 * Classifica uma linha do extrato de investimento pelo MEMO.
 * Ordem importa: I.R./I.O.F. contêm a palavra "RESGATE" no memo.
 */
export function classifyInvestmentMemo(memo: string): {
  type: InvestmentType;
  snapshot: boolean;
} {
  const m = norm(memo);
  const snapshot =
    m.includes("ATE ESTA DATA") || m.includes("PREVISAO") || m.includes("PREVISTO");

  if (m.includes("I.O.F") || m.includes("IOF")) return { type: "IOF_PREVISTO", snapshot: true };
  if (m.includes("I.R") || /\bIR\b/.test(m)) return { type: "IR_PREVISTO", snapshot: true };
  if (m.includes("RENDIMENTO")) return { type: "RENDIMENTO", snapshot };
  if (m.includes("APLICAC")) return { type: "APLICACAO", snapshot: false };
  if (m.includes("RESGATE")) return { type: "RESGATE", snapshot: false };
  return { type: "OUTRO", snapshot };
}

export interface RawEntry {
  date: string;
  amount: number; // com sinal
  memo: string;
  fitid: string | null;
}

/** Classifica todas as linhas de um extrato */
export function classifyEntries(entries: RawEntry[]): ClassifiedEntry[] {
  return entries
    .filter((e) => e.amount !== 0)
    .map((e) => {
      const { type, snapshot } = classifyInvestmentMemo(e.memo);
      return {
        date: e.date,
        type,
        description: e.memo.trim() || type,
        amount: round2(Math.abs(e.amount)),
        fitid: e.fitid,
        snapshot,
      };
    });
}

export interface SnapshotTotals {
  rendimento: number;
  irPrevisto: number;
  iofPrevisto: number;
}

/** Totais da fotografia (linhas snapshot) de um extrato */
export function snapshotTotals(entries: ClassifiedEntry[]): SnapshotTotals {
  let rendimento = 0, ir = 0, iof = 0;
  for (const e of entries) {
    if (!e.snapshot) continue;
    if (e.type === "RENDIMENTO") rendimento += e.amount;
    else if (e.type === "IR_PREVISTO") ir += e.amount;
    else if (e.type === "IOF_PREVISTO") iof += e.amount;
  }
  return { rendimento: round2(rendimento), irPrevisto: round2(ir), iofPrevisto: round2(iof) };
}

/** Fluxos (não-snapshot) de um extrato */
export function flowEntries(entries: ClassifiedEntry[]): ClassifiedEntry[] {
  return entries.filter((e) => !e.snapshot);
}

export interface ExistingFlow {
  date: Date;
  type: string;
  amount: number;
  description: string;
  fitid: string | null;
}

/**
 * Deduplicação de fluxos: FITID primeiro (identificador do banco),
 * multiplicidade por chave data|tipo|valor|descrição como fallback.
 */
export function dedupFlows(incoming: ClassifiedEntry[], existing: ExistingFlow[]) {
  const fitids = new Set(
    existing.filter((e) => e.fitid).map((e) => `${e.fitid}|${e.type}|${e.amount.toFixed(2)}`)
  );
  const keyOf = (date: string, type: string, amount: number, desc: string) =>
    `${date}|${type}|${amount.toFixed(2)}|${desc.trim().replace(/\s+/g, " ").toLowerCase()}`;
  const counts = new Map<string, number>();
  for (const e of existing) {
    const k = keyOf(e.date.toISOString().slice(0, 10), e.type, e.amount, e.description);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const fresh: ClassifiedEntry[] = [];
  let duplicates = 0;
  for (const e of incoming) {
    if (e.fitid && fitids.has(`${e.fitid}|${e.type}|${e.amount.toFixed(2)}`)) {
      duplicates++;
      continue;
    }
    const k = keyOf(e.date, e.type, e.amount, e.description);
    const remaining = counts.get(k) ?? 0;
    if (remaining > 0) {
      counts.set(k, remaining - 1);
      duplicates++;
    } else {
      fresh.push(e);
    }
  }
  return { fresh, duplicates };
}
