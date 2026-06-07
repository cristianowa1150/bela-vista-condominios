import * as XLSX from "xlsx";
import type { ParseResult, BankMetadata } from "./csv-parser";
import { parseAmount } from "./csv-parser";

export async function parseXLSX(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Extract metadata from raw cell values before JSON conversion
  const metadata = extractXLSXMetadata(worksheet);

  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];
  const errors: string[] = [];
  const data: ParseResult["data"] = [];

  rawData.forEach((row, idx) => {
    const strRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      strRow[k] = String(v ?? "").trim();
    }

    const parsed = tryParseXLSXRow(strRow, idx + 2);
    if (parsed.error) {
      errors.push(parsed.error);
    } else if (parsed.transaction) {
      data.push(parsed.transaction);
    }
  });

  return {
    data,
    errors,
    raw: rawData.map((r) => {
      const strRow: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) strRow[k] = String(v ?? "");
      return strRow;
    }),
    headers,
    metadata,
  };
}

function extractXLSXMetadata(worksheet: XLSX.WorkSheet): BankMetadata {
  const meta: BankMetadata = {};
  try {
    // Scan first 10 rows for metadata cells
    for (let row = 1; row <= 10; row++) {
      for (let col = 0; col < 5; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: row - 1, c: col });
        const cell = worksheet[cellAddr];
        if (!cell) continue;
        const val = String(cell.v ?? "").trim();
        const lower = val.toLowerCase();

        if (lower.startsWith("saldo")) {
          // Check adjacent cell for the value
          const nextAddr = XLSX.utils.encode_cell({ r: row - 1, c: col + 1 });
          const nextCell = worksheet[nextAddr];
          if (nextCell) {
            const num = parseAmount(String(nextCell.v ?? ""));
            if (num !== null && num > 0) meta.saldo = num;
          }
        }

        const periodMatch = val.match(
          /(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i
        );
        if (periodMatch) {
          meta.periodLabel = `${periodMatch[1]} a ${periodMatch[2]}`;
          const [, d, m, y] = periodMatch[2].match(/(\d{2})\/(\d{2})\/(\d{4})/) ?? [];
          if (y && m) meta.periodEnd = `${y}-${m}`;
        }
      }
    }
  } catch { /* best-effort */ }
  return meta;
}

function tryParseXLSXRow(
  row: Record<string, string>,
  lineNum: number
): { transaction?: ParseResult["data"][0]; error?: string } {
  const dateKey = findKey(row, ["data", "date", "dt", "data lançamento", "data lancamento"]);
  const descKey = findKey(row, ["descrição", "descricao", "historico", "histórico", "description", "memo", "lançamento"]);
  const amountKey = findKey(row, ["valor", "value", "amount", "débito", "debito", "crédito", "credito"]);

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
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const found = rowKeys.find((k) => k.toLowerCase().trim() === candidate.toLowerCase());
    if (found) return found;
  }
  for (const candidate of candidates) {
    const found = rowKeys.find(
      (k) => k.toLowerCase().trim().includes(candidate.toLowerCase())
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

