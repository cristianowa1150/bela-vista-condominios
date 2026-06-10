import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_READ, ROLES_IMPORT, round2 } from "@/lib/authz";
import { parseCSV } from "@/lib/parsers/csv-parser";
import { parseXLSX } from "@/lib/parsers/xlsx-parser";
import { parseOFX } from "@/lib/parsers/ofx-parser";
import { parsePDF } from "@/lib/parsers/pdf-parser";
import { parseTXT } from "@/lib/parsers/txt-parser";

function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    startDate: new Date(year, m - 1, 1),
    endDate: new Date(year, m, 0, 23, 59, 59),
  };
}

import { splitWithExisting, type DedupRow } from "@/lib/import-dedup";

/**
 * Separa as transações do extrato em novas vs. duplicadas, comparando com o
 * que já existe no banco dentro do intervalo de datas do extrato.
 * A lógica pura (chave + multiplicidade) vive em src/lib/import-dedup.ts.
 */
async function splitDuplicates(rows: DedupRow[]) {
  if (rows.length === 0) return { fresh: [] as DedupRow[], duplicates: 0 };

  const dates = rows.map((r) => new Date(r.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(23, 59, 59, 999);

  const existing = await prisma.transaction.findMany({
    where: { date: { gte: minDate, lte: maxDate } },
    select: { date: true, type: true, amount: true, description: true },
  });

  return splitWithExisting(rows, existing);
}

export async function POST(request: NextRequest) {
  const { session, error } = await authorize(ROLES_IMPORT);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const previewOnly = formData.get("previewOnly") === "true";
  const replaceMode = formData.get("replaceMode") === "true";

  if (!file) {
    return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // ── Hash do arquivo: bloqueia reimportação do MESMO extrato ──────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const previousImport = await prisma.importHistory.findFirst({
    where: { fileHash, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
  });

  let parseResult;
  try {
    if (ext === "csv") {
      parseResult = await parseCSV(file);
    } else if (ext === "ofx") {
      parseResult = await parseOFX(file);
    } else if (ext === "pdf") {
      parseResult = await parsePDF(file);
    } else if (ext === "txt") {
      parseResult = await parseTXT(file);
    } else if (ext === "xlsx" || ext === "xls") {
      parseResult = await parseXLSX(file);
    } else {
      return Response.json(
        { error: "Formato não suportado. Use CSV, OFX, PDF ou TXT." },
        { status: 400 }
      );
    }
  } catch (err) {
    return Response.json({ error: `Erro ao processar arquivo: ${String(err)}` }, { status: 500 });
  }

  const { metadata } = parseResult;

  // Verificação de duplicidade transação a transação
  const { fresh, duplicates } = await splitDuplicates(parseResult.data);

  // Check for period conflict (existing transactions in detected month)
  let periodConflict: { month: string; existingCount: number } | null = null;
  if (metadata.periodEnd) {
    const { startDate, endDate } = monthRange(metadata.periodEnd);
    const existingCount = await prisma.transaction.count({
      where: { date: { gte: startDate, lte: endDate } },
    });
    if (existingCount > 0) {
      periodConflict = { month: metadata.periodEnd, existingCount };
    }
  }

  if (previewOnly) {
    return Response.json({
      preview: parseResult.data.slice(0, 20),
      total: parseResult.data.length,
      newCount: fresh.length,
      duplicateCount: duplicates,
      alreadyImported: previousImport
        ? { filename: previousImport.filename, importedAt: previousImport.createdAt }
        : null,
      errors: parseResult.errors.slice(0, 10),
      headers: parseResult.headers,
      metadata,
      periodConflict,
    });
  }

  if (parseResult.data.length === 0) {
    return Response.json(
      { error: "Nenhuma transação válida encontrada no arquivo", errors: parseResult.errors },
      { status: 422 }
    );
  }

  // ── Arquivo idêntico já importado (exceto em modo substituição) ──────────
  if (previousImport && !replaceMode) {
    return Response.json(
      {
        error:
          `Importação bloqueada: este arquivo é idêntico a "${previousImport.filename}", ` +
          `importado em ${new Date(previousImport.createdAt).toLocaleString("pt-BR")}. ` +
          `Nenhuma transação foi adicionada para evitar duplicidade.`,
        reason: "DUPLICATE_FILE",
      },
      { status: 409 }
    );
  }

  // ── Replace mode: delete existing transactions for detected period ──────
  let rowsToImport = fresh;
  let skippedDuplicates = duplicates;
  if (replaceMode && metadata.periodEnd) {
    const { startDate, endDate } = monthRange(metadata.periodEnd);
    await prisma.transaction.deleteMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    await prisma.importHistory.deleteMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        userId: session.user.id,
      },
    });
    // Após apagar o período, recalcula duplicatas (sobram só as de fora do mês)
    const recheck = await splitDuplicates(parseResult.data);
    rowsToImport = recheck.fresh;
    skippedDuplicates = recheck.duplicates;
  }

  // ── Todas as transações já existem: não importa nada e explica o motivo ──
  if (rowsToImport.length === 0) {
    return Response.json(
      {
        error:
          `Importação bloqueada: todas as ${parseResult.data.length} transações deste extrato ` +
          `já existem no sistema (mesma data, valor e descrição). ` +
          `Nenhum registro foi adicionado para garantir a exatidão da prestação de contas.`,
        reason: "ALL_DUPLICATES",
        duplicates: skippedDuplicates,
      },
      { status: 409 }
    );
  }

  // Save import history
  const importRecord = await prisma.importHistory.create({
    data: {
      userId: session.user.id,
      filename,
      fileType: ext.toUpperCase(),
      fileHash,
      recordCount: rowsToImport.length,
      status: "SUCCESS",
    },
  });

  // Save transactions (somente as não duplicadas)
  const created = await prisma.transaction.createMany({
    data: rowsToImport.map((t) => ({
      userId: session.user.id,
      type: t.type,
      description: t.description,
      amount: t.amount,
      date: new Date(t.date),
      source: ext.toUpperCase(),
      importId: importRecord.id,
    })),
  });

  // ── Auto-save AccountStatement from bank metadata ──
  // Totais sempre recalculados a partir do banco de dados (fonte única da verdade)
  if (metadata.saldo !== undefined && metadata.periodEnd) {
    const month = metadata.periodEnd;
    const { startDate, endDate } = monthRange(month);

    const [rec, desp] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: "RECEITA", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "DESPESA", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);

    const totalReceitas = round2(rec._sum.amount ?? 0);
    const totalDespesas = round2(desp._sum.amount ?? 0);

    await prisma.accountStatement.upsert({
      where: { month },
      create: {
        month,
        saldoEmConta: metadata.saldo,
        totalReceitas,
        totalDespesas,
        resultado: round2(totalReceitas - totalDespesas),
        notes: metadata.periodLabel
          ? `Importado do extrato: ${metadata.periodLabel}`
          : null,
      },
      update: {
        saldoEmConta: metadata.saldo,
        totalReceitas,
        totalDespesas,
        resultado: round2(totalReceitas - totalDespesas),
      },
    });
  }

  return Response.json({
    success: true,
    imported: created.count,
    duplicatesSkipped: skippedDuplicates,
    errors: parseResult.errors,
    importId: importRecord.id,
    metadata,
    replaced: replaceMode,
  });
}

export async function GET() {
  const { session, error } = await authorize(ROLES_READ);
  if (error) return error;

  // Histórico de importações é compartilhado entre os perfis aprovados
  const imports = await prisma.importHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json(imports);
}
