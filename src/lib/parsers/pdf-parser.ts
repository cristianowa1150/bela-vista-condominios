/**
 * Parser de extratos em PDF.
 *
 * Extrai o texto do PDF (pdf-parse) e aplica heurística linha a linha:
 * uma linha é um lançamento quando contém uma data dd/mm/aaaa e um valor
 * monetário no formato brasileiro. O sinal (ou sufixo D/C) define o tipo.
 *
 * Linhas de saldo ("SALDO", "S A L D O") são usadas para metadados e
 * excluídas dos lançamentos — saldo não é movimentação.
 */
import type { ParseResult, ParsedTransaction, BankMetadata } from "./csv-parser";
import { parseAmount } from "./csv-parser";

const DATE_RE = /(\d{2})\/(\d{2})\/(\d{4})/;
// Valor BR no fim ou meio da linha: 1.234,56  -1.234,56  1.234,56-  1.234,56 D
const AMOUNT_RE = /(-?\s?\d{1,3}(?:\.\d{3})*,\d{2})\s*(-|D|C)?(?=\s|$)/gi;

const BALANCE_WORDS = ["saldo", "s a l d o", "total disponível", "total disponivel"];

function isBalanceLine(lower: string): boolean {
  return BALANCE_WORDS.some((w) => lower.includes(w));
}

export async function parsePDF(file: File): Promise<ParseResult> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    text = result.text;
    await parser.destroy();
  } catch (err) {
    return {
      data: [],
      errors: [`Não foi possível ler o PDF: ${String(err)}. PDFs digitalizados (imagem) não são suportados — exporte o extrato em CSV ou OFX.`],
      raw: [],
      headers: [],
      metadata: {},
    };
  }

  return parseStatementText(text, "PDF");
}

/**
 * Heurística genérica para extratos em texto livre (PDF extraído ou TXT):
 * uma linha com data dd/mm/aaaa + valor BR é um lançamento.
 */
export function parseStatementText(text: string, label: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const data: ParsedTransaction[] = [];
  const metadata: BankMetadata = {};
  let lastDate: string | null = null;
  let maxDate = "";

  for (const line of lines) {
    const lower = line.toLowerCase();

    const dateMatch = line.match(DATE_RE);
    const amounts = [...line.matchAll(AMOUNT_RE)];

    // Linha de saldo: captura para metadados, nunca vira lançamento
    if (isBalanceLine(lower)) {
      if (amounts.length > 0) {
        const v = parseAmount(amounts[amounts.length - 1][1].replace(/\s/g, ""));
        if (v !== null) metadata.saldo = Math.abs(v);
      }
      continue;
    }

    if (amounts.length === 0) continue;

    // Data da linha ou herdada da linha anterior (extratos que agrupam por dia)
    let date: string | null = null;
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      const month = Number(m), day = Number(d);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        date = `${y}-${m}-${d}`;
        lastDate = date;
      }
    } else {
      date = lastDate;
    }
    if (!date) continue;

    // Primeiro valor da linha = movimentação (o último pode ser saldo corrente)
    const match = amounts[0];
    const rawAmount = match[1].replace(/\s/g, "");
    const suffix = (match[2] ?? "").toUpperCase();
    const value = parseAmount(rawAmount);
    if (value === null || value === 0) continue;

    const isDebit = suffix === "D" || suffix === "-" || rawAmount.startsWith("-");

    // Descrição: linha sem a data e sem os valores
    let description = line
      .replace(DATE_RE, "")
      .replace(AMOUNT_RE, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!description) description = `Lançamento ${label}`;

    if (date > maxDate) maxDate = date;

    data.push({
      date,
      description,
      amount: Math.abs(value),
      type: isDebit ? "DESPESA" : "RECEITA",
    });
  }

  if (maxDate) {
    metadata.periodEnd = maxDate.substring(0, 7);
  }

  if (data.length === 0) {
    errors.push(
      `Nenhum lançamento reconhecido no ${label}. Confira se o arquivo contém texto ` +
      "(PDF digitalizado/imagem não é suportado) ou exporte o extrato em CSV/OFX para importação exata."
    );
  }

  return { data, errors, raw: [], headers: ["Data", "Descrição", "Valor"], metadata };
}
