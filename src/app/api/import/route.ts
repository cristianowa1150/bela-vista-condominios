import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/parsers/csv-parser";
import { parseXLSX } from "@/lib/parsers/xlsx-parser";

function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    startDate: new Date(year, m - 1, 1),
    endDate: new Date(year, m, 0, 23, 59, 59),
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const previewOnly = formData.get("previewOnly") === "true";
  const replaceMode = formData.get("replaceMode") === "true";

  if (!file) {
    return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  let parseResult;
  try {
    if (ext === "csv") {
      parseResult = await parseCSV(file);
    } else if (ext === "xlsx" || ext === "xls") {
      parseResult = await parseXLSX(file);
    } else {
      return Response.json(
        { error: "Formato não suportado. Use CSV ou XLSX/XLS." },
        { status: 400 }
      );
    }
  } catch (err) {
    return Response.json({ error: `Erro ao processar arquivo: ${String(err)}` }, { status: 500 });
  }

  const { metadata } = parseResult;

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

  // ── Replace mode: delete existing transactions for detected period ──
  if (replaceMode && metadata.periodEnd) {
    const { startDate, endDate } = monthRange(metadata.periodEnd);
    await prisma.transaction.deleteMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    // Also remove import records for that period
    await prisma.importHistory.deleteMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        userId: session.user.id,
      },
    });
  }

  // Save import history
  const importRecord = await prisma.importHistory.create({
    data: {
      userId: session.user.id,
      filename,
      fileType: ext.toUpperCase(),
      recordCount: parseResult.data.length,
      status: "SUCCESS",
    },
  });

  // Save transactions
  const created = await prisma.transaction.createMany({
    data: parseResult.data.map((t) => ({
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

    const totalReceitas = rec._sum.amount ?? 0;
    const totalDespesas = desp._sum.amount ?? 0;

    await prisma.accountStatement.upsert({
      where: { month },
      create: {
        month,
        saldoEmConta: metadata.saldo,
        totalReceitas,
        totalDespesas,
        resultado: totalReceitas - totalDespesas,
        notes: metadata.periodLabel
          ? `Importado do extrato: ${metadata.periodLabel}`
          : null,
      },
      update: {
        saldoEmConta: metadata.saldo,
        totalReceitas,
        totalDespesas,
        resultado: totalReceitas - totalDespesas,
      },
    });
  }

  return Response.json({
    success: true,
    imported: created.count,
    errors: parseResult.errors,
    importId: importRecord.id,
    metadata,
    replaced: replaceMode,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const imports = await prisma.importHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json(imports);
}
