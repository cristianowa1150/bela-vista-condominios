/**
 * Parser de extratos OFX (Open Financial Exchange) — formato padrão dos
 * bancos brasileiros (Bradesco, Itaú, BB, Caixa, Inter, Sicoob, Sicredi…).
 *
 * OFX é SGML/XML: cada lançamento vive num bloco <STMTTRN> com
 * DTPOSTED (data), TRNAMT (valor com sinal) e MEMO/NAME (descrição).
 * O saldo da conta vem em <LEDGERBAL><BALAMT> e o fim do período em <DTEND>.
 */
import type { ParseResult, ParsedTransaction, BankMetadata } from "./csv-parser";

function decodeOfx(buffer: ArrayBuffer): string {
  // OFX brasileiro frequentemente usa Latin-1/Windows-1252
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (utf8.includes("�")) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
  return utf8;
}

/** Extrai o valor de uma tag OFX (SGML sem fechamento ou XML com fechamento) */
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([^<\r\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

/** DTPOSTED: "20260605", "20260605120000" ou "20260605120000[-3:BRT]" */
function parseOfxDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** TRNAMT: ponto OU vírgula como separador decimal, sinal opcional */
function parseOfxAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Lançamento OFX bruto, com FITID — usado pelo módulo de investimentos */
export interface OfxEntry {
  date: string;        // YYYY-MM-DD
  amount: number;      // com sinal, como veio no extrato
  memo: string;
  fitid: string | null;
  trntype: string | null;
}

export interface OfxEntriesResult {
  entries: OfxEntry[];
  saldo: number | null;     // LEDGERBAL BALAMT
  dtAsOf: string | null;    // LEDGERBAL DTASOF (YYYY-MM-DD)
  periodStart: string | null;
  periodEnd: string | null;
  errors: string[];
}

/**
 * Extrai os lançamentos OFX preservando FITID/MEMO/sinal — sem interpretar
 * como receita/despesa. Base do parser de extratos de investimento.
 */
export async function parseOFXEntries(file: File): Promise<OfxEntriesResult> {
  const text = decodeOfx(await file.arrayBuffer());
  const errors: string[] = [];
  const entries: OfxEntry[] = [];

  let saldo: number | null = null;
  let dtAsOf: string | null = null;
  const ledger = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL|<\/BANKSTMTRS|$)/i);
  if (ledger) {
    const bal = tag(ledger[1], "BALAMT");
    if (bal !== null) saldo = parseOfxAmount(bal);
    const asof = tag(ledger[1], "DTASOF");
    if (asof !== null) dtAsOf = parseOfxDate(asof);
  }

  const dtStartM = text.match(/<DTSTART>([^<\r\n]*)/i);
  const dtEndM = text.match(/<DTEND>([^<\r\n]*)/i);
  const periodStart = dtStartM ? parseOfxDate(dtStartM[1].trim()) : null;
  const periodEnd = dtEndM ? parseOfxDate(dtEndM[1].trim()) : null;

  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  blocks.forEach((block, idx) => {
    const rawDate = tag(block, "DTPOSTED");
    const rawAmount = tag(block, "TRNAMT");
    if (!rawDate || !rawAmount) {
      errors.push(`Lançamento ${idx + 1}: bloco OFX sem DTPOSTED ou TRNAMT`);
      return;
    }
    const date = parseOfxDate(rawDate);
    const amount = parseOfxAmount(rawAmount);
    if (!date || amount === null) {
      errors.push(`Lançamento ${idx + 1}: data ou valor inválido`);
      return;
    }
    entries.push({
      date,
      amount,
      memo: tag(block, "MEMO") || tag(block, "NAME") || "",
      fitid: tag(block, "FITID"),
      trntype: tag(block, "TRNTYPE"),
    });
  });

  if (blocks.length === 0) {
    errors.push("Nenhum bloco <STMTTRN> encontrado no arquivo OFX.");
  }

  return { entries, saldo, dtAsOf, periodStart, periodEnd, errors };
}

export async function parseOFX(file: File): Promise<ParseResult> {
  const text = decodeOfx(await file.arrayBuffer());
  const errors: string[] = [];
  const data: ParsedTransaction[] = [];
  const metadata: BankMetadata = {};

  // ── Metadados ──────────────────────────────────────────────────────────
  const ledgerBlock = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL|<\/BANKSTMTRS|$)/i);
  if (ledgerBlock) {
    const bal = tag(ledgerBlock[1], "BALAMT");
    if (bal !== null) {
      const v = parseOfxAmount(bal);
      if (v !== null) metadata.saldo = v;
    }
  }

  const dtStart = text.match(/<DTSTART>([^<\r\n]*)/i);
  const dtEnd = text.match(/<DTEND>([^<\r\n]*)/i);
  if (dtEnd) {
    const end = parseOfxDate(dtEnd[1].trim());
    if (end) {
      metadata.periodEnd = end.substring(0, 7);
      const start = dtStart ? parseOfxDate(dtStart[1].trim()) : null;
      const fmt = (iso: string) => iso.split("-").reverse().join("/");
      metadata.periodLabel = start ? `${fmt(start)} a ${fmt(end)}` : fmt(end);
    }
  }

  const acct = text.match(/<ACCTID>([^<\r\n]*)/i);
  if (acct) metadata.conta = acct[1].trim();

  // ── Lançamentos ────────────────────────────────────────────────────────
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];

  blocks.forEach((block, idx) => {
    const rawDate = tag(block, "DTPOSTED");
    const rawAmount = tag(block, "TRNAMT");
    const description =
      tag(block, "MEMO") || tag(block, "NAME") || tag(block, "TRNTYPE") || "Lançamento OFX";

    if (!rawDate || !rawAmount) {
      errors.push(`Lançamento ${idx + 1}: bloco OFX sem DTPOSTED ou TRNAMT`);
      return;
    }

    const date = parseOfxDate(rawDate);
    if (!date) {
      errors.push(`Lançamento ${idx + 1}: data inválida "${rawDate}"`);
      return;
    }

    const amount = parseOfxAmount(rawAmount);
    if (amount === null) {
      errors.push(`Lançamento ${idx + 1}: valor inválido "${rawAmount}"`);
      return;
    }
    if (amount === 0) return;

    data.push({
      date,
      description,
      amount: Math.abs(amount),
      type: amount >= 0 ? "RECEITA" : "DESPESA",
    });
  });

  if (blocks.length === 0) {
    errors.push("Nenhum bloco <STMTTRN> encontrado — o arquivo é um OFX de extrato bancário?");
  }

  return { data, errors, raw: [], headers: ["DTPOSTED", "MEMO", "TRNAMT"], metadata };
}
