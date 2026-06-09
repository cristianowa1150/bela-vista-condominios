/**
 * Parser de extratos TXT.
 *
 * Estratégia em duas etapas:
 *   1. Tenta como CSV delimitado (";", tab, "," — bancos costumam exportar
 *      TXT que na verdade é CSV com outra extensão);
 *   2. Se nenhuma transação for reconhecida, aplica a heurística de texto
 *      livre (data dd/mm/aaaa + valor BR por linha), a mesma usada em PDF.
 */
import type { ParseResult } from "./csv-parser";
import { parseCSV } from "./csv-parser";
import { parseStatementText } from "./pdf-parser";

export async function parseTXT(file: File): Promise<ParseResult> {
  const asCsv = await parseCSV(file);
  if (asCsv.data.length > 0) return asCsv;

  const text = await file.text();
  const asText = parseStatementText(text, "TXT");

  // Preserva metadados que o cabeçalho CSV possa ter detectado
  return {
    ...asText,
    metadata: { ...asCsv.metadata, ...asText.metadata },
  };
}
