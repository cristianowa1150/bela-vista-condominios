/**
 * src/lib/finance.ts
 *
 * Funções financeiras puras e centralizadas — toda soma/divisão monetária do
 * sistema passa por aqui, sempre arredondada a 2 casas (round2) para garantir
 * precisão exata de prestação de contas (sem resíduo de ponto flutuante).
 *
 * Sem dependência de banco/React: 100% testável de forma determinística.
 */
import { round2 } from "./money";

export interface AmountItem {
  amount: number;
  type?: string;
}

export interface CategorizedTx {
  amount: number;
  type: string;
  category?: { name: string; color: string } | null;
}

export interface DatedTx {
  amount: number;
  type: string;
  date: string; // ISO ("2026-06-10" ou "2026-06-10T...")
}

/** Soma de valores, arredondada a 2 casas. */
export function sumAmounts(items: { amount: number }[]): number {
  return round2(items.reduce((s, t) => s + t.amount, 0));
}

/** Soma apenas dos itens de um tipo ("RECEITA" | "DESPESA"). */
export function sumByType(items: AmountItem[], type: string): number {
  return round2(items.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0));
}

/** Resultado = receitas − despesas (cada lado arredondado antes da subtração). */
export function computeResultado(receitas: number, despesas: number): number {
  return round2(round2(receitas) - round2(despesas));
}

/** Ticket médio com proteção contra divisão por zero. */
export function ticketMedio(total: number, count: number): number {
  return count > 0 ? round2(total / count) : 0;
}

/** Percentual de uma parte sobre o total (0 quando o total é 0). */
export function percentual(part: number, total: number): number {
  return total > 0 ? round2((part / total) * 100) : 0;
}

/** Agrupa por categoria somando valores (arredondado), ordenado do maior ao menor. */
export function groupByCategory(txs: CategorizedTx[]) {
  const map: Record<string, { name: string; color: string; value: number }> = {};
  for (const t of txs) {
    const key = t.category?.name ?? "Sem categoria";
    if (!map[key]) map[key] = { name: key, color: t.category?.color ?? "#94a3b8", value: 0 };
    map[key].value += t.amount;
  }
  return Object.values(map)
    .map((c) => ({ ...c, value: round2(c.value) }))
    .sort((a, b) => b.value - a.value);
}

/** Agrupa por dia (chave ISO), somando receitas e despesas separadamente. */
export function groupByDay(txs: DatedTx[]) {
  const map: Record<string, { day: string; receitas: number; despesas: number }> = {};
  for (const t of txs) {
    const day = t.date.split("T")[0];
    if (!map[day]) map[day] = { day, receitas: 0, despesas: 0 };
    if (t.type === "RECEITA") map[day].receitas += t.amount;
    else map[day].despesas += t.amount;
  }
  return Object.values(map)
    .map((d) => ({ day: d.day, receitas: round2(d.receitas), despesas: round2(d.despesas) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

// ─── Navegação e intervalos de mês ("YYYY-MM") ───────────────────────────────

/** Mês corrente no formato "YYYY-MM". */
export function currentMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

/** Mês anterior — trata a virada de ano (jan → dez do ano anterior). */
export function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Próximo mês — trata a virada de ano (dez → jan do ano seguinte). */
export function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Intervalo [primeiro instante, último instante] de um mês "YYYY-MM". */
export function monthRange(month: string): { startDate: Date; endDate: Date } {
  const [year, m] = month.split("-").map(Number);
  return {
    startDate: new Date(year, m - 1, 1),
    endDate: new Date(year, m, 0, 23, 59, 59),
  };
}
