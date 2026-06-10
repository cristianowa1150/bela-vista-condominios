/**
 * Parser do "EXTRATO DE POSIÇÃO DE RENDA FIXA" (PDF do Inter DTVM).
 *
 * É o documento autoritativo da carteira: cada ativo com valor aplicado,
 * rendimento, bruto, líquido e previsão de IR/IOF, mais os totais oficiais.
 *
 * Validação de integridade (prestação de contas):
 *  - por ativo: bruto = aplicado + rendimento − retirada (tolerância 2 centavos)
 *  - totais: Σ linhas deve bater com os totais impressos no PDF
 * Divergência => erro bloqueante (não importa dado inconsistente).
 */
import { parseAmount } from "./csv-parser";
import { round2 } from "@/lib/money";

export interface PosicaoAtivo {
  nota: string;
  dataInicio: string;     // YYYY-MM-DD
  vencimento: string;     // YYYY-MM-DD
  aplicado: number;
  rendimento: number;
  retirada: number;
  bruto: number;
  liquido: number;
  irIofPrevisto: number;
}

export interface PosicaoResult {
  date: string | null;    // "Posição em"
  ativos: PosicaoAtivo[];
  totals: { aplicado: number; bruto: number; liquido: number; irIof: number };
  errors: string[];
}

/** O texto extraído é de um extrato de posição de renda fixa? */
export function isPosicaoStatement(text: string): boolean {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return t.includes("EXTRATO DE POSICAO DE RENDA FIXA") || t.includes("POSICAO DE RENDA FIXA");
}

const brToIso = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
};

export function parsePosicaoText(text: string): PosicaoResult {
  const errors: string[] = [];
  const ativos: PosicaoAtivo[] = [];

  // Data da posição
  const dateM = text.match(/Posi[çc][ãa]o em:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const date = dateM ? brToIso(dateM[1]) : null;
  if (!date) errors.push('Data "Posição em" não encontrada no PDF.');

  // ── Linhas de ativos ──────────────────────────────────────────────────────
  // Formato extraído (ordem das colunas no texto):
  //   R$ <irIof>  <nota 9+ díg> <dataInício> <vencimento> R$ <aplicado>
  //   R$ <rendimento> ... R$ <líquido> R$ <bruto> R$ <retirada> R$ <desconto>
  const rowRe =
    /R\$\s*([\d.,]+)\s+(\d{6,})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([^\n]+)/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null) {
    const irIof = parseAmount(m[1]);
    const nota = m[2];
    const dataInicio = brToIso(m[3]);
    const vencimento = brToIso(m[4]);
    const rest = m[5];

    // Demais valores R$ da linha, na ordem: aplicado, rendimento, líquido, bruto, retirada, desconto
    const amounts = [...rest.matchAll(/R\$\s*([\d.,]+)/g)]
      .map((a) => parseAmount(a[1]))
      .filter((v): v is number => v !== null);

    if (irIof === null || amounts.length < 4) {
      errors.push(`Nota ${nota}: linha com valores ilegíveis.`);
      continue;
    }

    const [aplicado, rendimento, liquido, bruto, retirada = 0] = amounts;

    // bruto e líquido podem vir em qualquer ordem na extração — bruto ≥ líquido
    const b = Math.max(liquido, bruto);
    const l = Math.min(liquido, bruto);

    // Integridade da linha: bruto = aplicado + rendimento − retirada
    const esperado = round2(aplicado + rendimento - retirada);
    if (Math.abs(esperado - b) > 0.02) {
      errors.push(
        `Nota ${nota}: bruto ${b.toFixed(2)} ≠ aplicado+rendimento−retirada ${esperado.toFixed(2)}.`
      );
    }
    // líquido = bruto − IR/IOF previsto
    if (Math.abs(round2(b - irIof) - l) > 0.02) {
      errors.push(`Nota ${nota}: líquido ${l.toFixed(2)} ≠ bruto−IR/IOF ${round2(b - irIof).toFixed(2)}.`);
    }

    ativos.push({
      nota, dataInicio, vencimento,
      aplicado: round2(aplicado),
      rendimento: round2(rendimento),
      retirada: round2(retirada),
      bruto: round2(b),
      liquido: round2(l),
      irIofPrevisto: round2(irIof),
    });
  }

  if (ativos.length === 0) {
    errors.push("Nenhum ativo reconhecido no extrato de posição.");
  }

  // ── Totais calculados das linhas ─────────────────────────────────────────
  const totals = {
    aplicado: round2(ativos.reduce((s, a) => s + a.aplicado, 0)),
    bruto: round2(ativos.reduce((s, a) => s + a.bruto, 0)),
    liquido: round2(ativos.reduce((s, a) => s + a.liquido, 0)),
    irIof: round2(ativos.reduce((s, a) => s + a.irIofPrevisto, 0)),
  };

  // ── Conferência com os totais impressos no PDF ───────────────────────────
  const totalsLineM = text.match(/([^\n]*Valor\s+Bruto\s+Total[^\n]*)/i);
  if (totalsLineM) {
    const printed = [...totalsLineM[1].matchAll(/R\$\s*([\d.,]+)/g)]
      .map((a) => parseAmount(a[1]))
      .filter((v): v is number => v !== null)
      .map(round2);
    for (const computed of [totals.liquido, totals.bruto, totals.aplicado]) {
      if (!printed.some((p) => Math.abs(p - computed) <= 0.02)) {
        errors.push(
          `Total calculado ${computed.toFixed(2)} não confere com os totais impressos no PDF ` +
          `(${printed.map((p) => p.toFixed(2)).join(", ")}).`
        );
      }
    }
  }

  return { date, ativos, totals, errors };
}
