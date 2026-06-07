import Papa from "papaparse";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "RECEITA" | "DESPESA";
}

export interface BankMetadata {
  saldo?: number;          // saldo real da conta (ex: 2903.44)
  periodEnd?: string;      // mês de referência ex: "2026-06"
  periodLabel?: string;    // ex: "06/05/2026 a 05/06/2026"
  conta?: string;
}

export interface ParseResult {
  data: ParsedTransaction[];
  errors: string[];
  raw: Record<string, string>[];
  headers: string[];
  metadata: BankMetadata;
}

// Keywords that identify the real data header row
const HEADER_KEYWORDS = [
  "data", "date", "dt",
  "descrição", "descricao", "description", "historico", "histórico",
  "valor", "value", "amount", "débito", "credito", "crédito", "debito",
];

function findDataStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const matches = HEADER_KEYWORDS.filter((k) => lower.includes(k)).length;
    if (matches >= 2) return i;
  }
  return 0;
}

function extractMetadata(headerLines: string[]): BankMetadata {
  const meta: BankMetadata = {};

  for (const line of headerLines) {
    const lower = line.toLowerCase().trim();
    if (!lower) continue;

    // Saldo: "Saldo: ;2.903,44"  or  "Saldo ;2.903,44"
    if (lower.startsWith("saldo")) {
      const match = line.match(/;([0-9.,]+)/);
      if (match) {
        const val = parseAmount(match[1].trim());
        if (val !== null && val > 0) meta.saldo = val;
      }
    }

    // Period: "Período ;06/05/2026 a 05/06/2026"
    const periodMatch = line.match(
      /(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i
    );
    if (periodMatch) {
      meta.periodLabel = `${periodMatch[1]} a ${periodMatch[2]}`;
      const endDate = parseDate(periodMatch[2]);
      if (endDate) meta.periodEnd = endDate.substring(0, 7);
    }

    // Conta: "Conta ;25907360"
    if (lower.startsWith("conta")) {
      const match = line.match(/;(\S+)/);
      if (match) meta.conta = match[1].trim();
    }
  }

  return meta;
}

export async function parseCSV(file: File): Promise<ParseResult> {
  const rawText = await file.text();
  const lines = rawText.split(/\r?\n/);
  const dataStart = findDataStart(lines);

  // Extract bank metadata from header section
  const metadata = extractMetadata(lines.slice(0, dataStart));

  const dataText = lines.slice(dataStart).join("\n");

  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(dataText, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
      complete: (results) => {
        const raw = results.data;
        const headers = results.meta.fields ?? [];
        const errors: string[] = [];
        const data: ParsedTransaction[] = [];

        raw.forEach((row, idx) => {
          const parsed = tryParseRow(row, idx + dataStart + 2);
          if (parsed.error) errors.push(parsed.error);
          else if (parsed.transaction) data.push(parsed.transaction);
        });

        resolve({ data, errors, raw, headers, metadata });
      },
      error: (error: { message: string }) => {
        resolve({ data: [], errors: [error.message], raw: [], headers: [], metadata });
      },
    });
  });
}

function tryParseRow(
  row: Record<string, string>,
  lineNum: number
): { transaction?: ParsedTransaction; error?: string } {
  const dateKey = findKey(row, [
    "data", "data lançamento", "data lancamento", "data movimentação",
    "data movimentacao", "date", "dt",
  ]);
  const descKey = findKey(row, [
    "descrição", "descricao", "historico", "histórico", "description",
    "memo", "lançamento", "lancamento", "complemento", "detalhe", "texto",
  ]);
  // "Valor" but NOT "Saldo" — the running balance column must be excluded
  const amountKey = findKeyExcluding(row, [
    "valor", "value", "amount", "débito", "debito", "crédito", "credito",
    "vlr", "montante", "mov",
  ], ["saldo", "balance"]);

  if (!dateKey || !descKey || !amountKey) {
    return {
      error: `Linha ${lineNum}: colunas obrigatórias não encontradas. Disponíveis: ${Object.keys(row).join(", ")}`,
    };
  }

  const rawDate = row[dateKey]?.trim();
  const rawDesc = row[descKey]?.trim();
  const rawAmount = row[amountKey]?.trim();

  if (!rawDate || !rawDesc || !rawAmount) return {};

  const date = parseDate(rawDate);
  if (!date) return { error: `Linha ${lineNum}: data inválida "${rawDate}"` };

  const amount = parseAmount(rawAmount);
  if (amount === null) return { error: `Linha ${lineNum}: valor inválido "${rawAmount}"` };
  if (amount === 0) return {};

  return {
    transaction: {
      date,
      description: rawDesc,
      amount: Math.abs(amount),
      type: amount >= 0 ? "RECEITA" : "DESPESA",
    },
  };
}

function findKey(row: Record<string, string>, candidates: string[]): string | undefined {
  return findKeyExcluding(row, candidates, []);
}

function findKeyExcluding(
  row: Record<string, string>,
  candidates: string[],
  excluded: string[]
): string | undefined {
  const keys = Object.keys(row);
  // Exact match first (excluding blacklisted terms)
  for (const c of candidates) {
    const found = keys.find(
      (k) =>
        k.toLowerCase().trim() === c.toLowerCase() &&
        !excluded.some((ex) => k.toLowerCase().includes(ex))
    );
    if (found) return found;
  }
  // Partial match
  for (const c of candidates) {
    const found = keys.find(
      (k) =>
        k.toLowerCase().trim().includes(c.toLowerCase()) &&
        !excluded.some((ex) => k.toLowerCase().includes(ex))
    );
    if (found) return found;
  }
  return undefined;
}

function parseDate(raw: string): string | null {
  const brMatch = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const isoMatch = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

export function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/[R$\s"']/g, "");
  if (!cleaned) return null;

  // BR format: 1.234,56 (dot=thousands, comma=decimal)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
