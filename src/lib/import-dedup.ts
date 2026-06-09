/**
 * Lógica pura de deduplicação de lançamentos importados.
 *
 * Chave de identidade: data (dia) + tipo + valor com 2 casas + descrição
 * normalizada. A separação usa CONTROLE DE MULTIPLICIDADE: se o banco já tem
 * N ocorrências de uma chave e o extrato traz M, importa-se max(0, M - N).
 * Lançamentos legítimos repetidos são preservados; duplicatas, nunca.
 *
 * Módulo sem dependências de banco — 100% testável de forma determinística.
 */

export interface DedupRow {
  date: string;
  description: string;
  amount: number;
  type: string;
}

export interface ExistingTx {
  date: Date;
  type: string;
  amount: number;
  description: string;
}

export function txKey(date: Date, type: string, amount: number, description: string): string {
  const day = date.toISOString().slice(0, 10);
  const desc = description.trim().replace(/\s+/g, " ").toLowerCase();
  return `${day}|${type}|${amount.toFixed(2)}|${desc}`;
}

export function splitWithExisting(rows: DedupRow[], existing: ExistingTx[]) {
  const existingCount = new Map<string, number>();
  for (const t of existing) {
    const k = txKey(t.date, t.type, t.amount, t.description);
    existingCount.set(k, (existingCount.get(k) ?? 0) + 1);
  }

  const fresh: DedupRow[] = [];
  let duplicates = 0;
  for (const row of rows) {
    const k = txKey(new Date(row.date), row.type, row.amount, row.description);
    const remaining = existingCount.get(k) ?? 0;
    if (remaining > 0) {
      existingCount.set(k, remaining - 1);
      duplicates++;
    } else {
      fresh.push(row);
    }
  }
  return { fresh, duplicates };
}
