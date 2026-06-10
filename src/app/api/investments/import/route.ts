import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_IMPORT, round2 } from "@/lib/authz";
import { parseOFXEntries } from "@/lib/parsers/ofx-parser";
import { parseStatementText, extractPdfText } from "@/lib/parsers/pdf-parser";
import { isPosicaoStatement, parsePosicaoText } from "@/lib/parsers/posicao-parser";
import {
  classifyEntries,
  snapshotTotals,
  flowEntries,
  dedupFlows,
  type RawEntry,
} from "@/lib/investments";

const formatBR = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Importação de extratos de investimento (OFX ou PDF).
 *
 * Modelo financeiro:
 *  - Cada extrato gera/atualiza UMA fotografia (InvestmentStatement) na data
 *    DTASOF: posição total (LEDGERBAL), rendimento acumulado, IR e IOF
 *    previstos. Reimportar a mesma data SUBSTITUI a fotografia (idempotente).
 *  - APLICAÇÃO/RESGATE viram fluxos (InvestmentMovement, snapshot=false),
 *    deduplicados por FITID e por chave de multiplicidade.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await authorize(ROLES_IMPORT);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const previewOnly = formData.get("previewOnly") === "true";

  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const previousImport = await prisma.investmentStatement.findFirst({
    where: { fileHash },
  });

  // ── PDF "Extrato de Posição de Renda Fixa": documento autoritativo ───────
  if (ext === "pdf") {
    let pdfText: string;
    try {
      pdfText = await extractPdfText(file);
    } catch (err) {
      return Response.json(
        { error: `Não foi possível ler o PDF: ${String(err)}` },
        { status: 422 }
      );
    }

    if (isPosicaoStatement(pdfText)) {
      const pos = parsePosicaoText(pdfText);

      // Integridade é bloqueante: extrato de posição inconsistente não entra
      if (pos.errors.length > 0 || !pos.date) {
        return Response.json(
          {
            error:
              "O extrato de posição não passou na validação de integridade: " +
              pos.errors.slice(0, 3).join(" "),
            errors: pos.errors,
          },
          { status: 422 }
        );
      }

      const existingStatement = await prisma.investmentStatement.findUnique({
        where: { date: new Date(pos.date + "T12:00:00Z") },
      });

      if (previewOnly) {
        return Response.json({
          kind: "POSICAO",
          snapshotDate: pos.date,
          totalValue: pos.totals.bruto,
          aplicadoOficial: pos.totals.aplicado,
          liquidoOficial: pos.totals.liquido,
          rendimento: round2(pos.totals.bruto - pos.totals.aplicado),
          irPrevisto: pos.totals.irIof,
          iofPrevisto: 0,
          snapshotLines: pos.ativos.length,
          flowsTotal: 0,
          flowsNew: 0,
          flowsDuplicated: 0,
          willReplaceSnapshot: !!existingStatement,
          alreadyImported: previousImport
            ? { filename: previousImport.filename, importedAt: previousImport.createdAt }
            : null,
          preview: pos.ativos.slice(0, 20).map((a) => ({
            date: a.dataInicio,
            type: "POSICAO",
            description: `Nota ${a.nota} · aplicado ${a.aplicado.toFixed(2)} · bruto ${a.bruto.toFixed(2)}`,
            amount: a.bruto,
          })),
          errors: [],
        });
      }

      if (previousImport) {
        return Response.json(
          {
            error:
              `Importação bloqueada: este arquivo é idêntico a "${previousImport.filename}", ` +
              `importado em ${new Date(previousImport.createdAt).toLocaleString("pt-BR")}.`,
            reason: "DUPLICATE_FILE",
          },
          { status: 409 }
        );
      }

      const stmtDate = new Date(pos.date + "T12:00:00Z");
      const statement = await prisma.investmentStatement.upsert({
        where: { date: stmtDate },
        create: {
          date: stmtDate,
          kind: "POSICAO",
          totalValue: pos.totals.bruto, // posição oficial do banco
          rendimento: round2(pos.totals.bruto - pos.totals.aplicado),
          irPrevisto: pos.totals.irIof,
          iofPrevisto: 0,
          filename,
          fileHash,
          userId: session.user.id,
        },
        update: {
          kind: "POSICAO",
          totalValue: pos.totals.bruto,
          rendimento: round2(pos.totals.bruto - pos.totals.aplicado),
          irPrevisto: pos.totals.irIof,
          iofPrevisto: 0,
          filename,
          fileHash,
        },
      });

      // Linhas da fotografia: um registro por ativo (substitui as da data)
      await prisma.investmentMovement.deleteMany({
        where: { statementId: statement.id, snapshot: true },
      });
      await prisma.investmentMovement.createMany({
        data: pos.ativos.map((a) => ({
          date: stmtDate,
          type: "RENDIMENTO",
          description:
            `Nota ${a.nota} · aplicado ${formatBR(a.aplicado)} em ${brDate(a.dataInicio)} · ` +
            `bruto ${formatBR(a.bruto)} · líquido ${formatBR(a.liquido)}`,
          amount: a.rendimento,
          fitid: a.nota,
          snapshot: true,
          statementId: statement.id,
          userId: session.user.id,
        })),
      });

      return Response.json({
        success: true,
        kind: "POSICAO",
        snapshotDate: pos.date,
        totalValue: statement.totalValue,
        aplicadoOficial: pos.totals.aplicado,
        flowsImported: 0,
        flowsDuplicated: 0,
        snapshotReplaced: !!existingStatement,
      });
    }
    // Não é extrato de posição → segue o fluxo heurístico de movimentações
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  let raw: RawEntry[] = [];
  let saldo: number | null = null;
  let dtAsOf: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let parseErrors: string[] = [];

  try {
    if (ext === "ofx") {
      const r = await parseOFXEntries(file);
      raw = r.entries.map((e) => ({ date: e.date, amount: e.amount, memo: e.memo, fitid: e.fitid }));
      saldo = r.saldo;
      dtAsOf = r.dtAsOf;
      periodStart = r.periodStart;
      periodEnd = r.periodEnd;
      parseErrors = r.errors;
    } else if (ext === "pdf") {
      const { parsePDF } = await import("@/lib/parsers/pdf-parser");
      const r = await parsePDF(file);
      raw = r.data.map((t) => ({
        date: t.date,
        amount: t.type === "DESPESA" ? -t.amount : t.amount,
        memo: t.description,
        fitid: null,
      }));
      saldo = r.metadata.saldo ?? null;
      dtAsOf = r.metadata.periodEnd ? null : null;
      parseErrors = r.errors;
      // Sem DTASOF no PDF: usa a maior data dos lançamentos
      if (raw.length > 0) {
        dtAsOf = raw.map((e) => e.date).sort().at(-1) ?? null;
      }
    } else if (ext === "txt") {
      const text = new TextDecoder("utf-8").decode(fileBuffer);
      const r = parseStatementText(text, "TXT");
      raw = r.data.map((t) => ({
        date: t.date,
        amount: t.type === "DESPESA" ? -t.amount : t.amount,
        memo: t.description,
        fitid: null,
      }));
      saldo = r.metadata.saldo ?? null;
      if (raw.length > 0) dtAsOf = raw.map((e) => e.date).sort().at(-1) ?? null;
      parseErrors = r.errors;
    } else {
      return Response.json(
        { error: "Formato não suportado para investimentos. Use OFX (recomendado) ou PDF." },
        { status: 400 }
      );
    }
  } catch (err) {
    return Response.json({ error: `Erro ao processar arquivo: ${String(err)}` }, { status: 500 });
  }

  if (raw.length === 0) {
    return Response.json(
      { error: "Nenhum lançamento de investimento reconhecido no arquivo", errors: parseErrors },
      { status: 422 }
    );
  }

  // ── Classificação ────────────────────────────────────────────────────────
  const classified = classifyEntries(raw);
  const snap = snapshotTotals(classified);
  const flows = flowEntries(classified);
  const snapshotLines = classified.filter((e) => e.snapshot);

  // Data da fotografia: DTASOF do extrato (fallback: maior data)
  const snapshotDate = dtAsOf ?? classified.map((e) => e.date).sort().at(-1)!;

  // ── Dedup de fluxos contra o banco ───────────────────────────────────────
  const existing = await prisma.investmentMovement.findMany({
    where: { snapshot: false },
    select: { date: true, type: true, amount: true, description: true, fitid: true },
  });
  const { fresh, duplicates } = dedupFlows(flows, existing);

  const existingStatement = await prisma.investmentStatement.findUnique({
    where: { date: new Date(snapshotDate + "T12:00:00Z") },
  });

  if (previewOnly) {
    return Response.json({
      snapshotDate,
      totalValue: saldo,
      rendimento: snap.rendimento,
      irPrevisto: snap.irPrevisto,
      iofPrevisto: snap.iofPrevisto,
      snapshotLines: snapshotLines.length,
      flowsTotal: flows.length,
      flowsNew: fresh.length,
      flowsDuplicated: duplicates,
      willReplaceSnapshot: !!existingStatement,
      alreadyImported: previousImport
        ? { filename: previousImport.filename, importedAt: previousImport.createdAt }
        : null,
      preview: classified.slice(0, 20),
      errors: parseErrors.slice(0, 10),
    });
  }

  // ── Bloqueio: arquivo idêntico já importado ──────────────────────────────
  if (previousImport) {
    return Response.json(
      {
        error:
          `Importação bloqueada: este arquivo é idêntico a "${previousImport.filename}", ` +
          `importado em ${new Date(previousImport.createdAt).toLocaleString("pt-BR")}.`,
        reason: "DUPLICATE_FILE",
      },
      { status: 409 }
    );
  }

  // ── Gravação ─────────────────────────────────────────────────────────────
  const stmtDate = new Date(snapshotDate + "T12:00:00Z");

  // Fotografia: upsert pela data — substitui linhas snapshot da mesma data
  const statement = await prisma.investmentStatement.upsert({
    where: { date: stmtDate },
    create: {
      date: stmtDate,
      kind: "MOVIMENTACAO",
      totalValue: round2(saldo ?? 0), // saldo do arquivo (informativo)
      rendimento: snap.rendimento,
      irPrevisto: snap.irPrevisto,
      iofPrevisto: snap.iofPrevisto,
      periodStart: periodStart ? new Date(periodStart + "T12:00:00Z") : null,
      periodEnd: periodEnd ? new Date(periodEnd + "T12:00:00Z") : null,
      filename,
      fileHash,
      userId: session.user.id,
    },
    update: {
      kind: "MOVIMENTACAO",
      totalValue: round2(saldo ?? 0),
      rendimento: snap.rendimento,
      irPrevisto: snap.irPrevisto,
      iofPrevisto: snap.iofPrevisto,
      periodStart: periodStart ? new Date(periodStart + "T12:00:00Z") : null,
      periodEnd: periodEnd ? new Date(periodEnd + "T12:00:00Z") : null,
      filename,
      fileHash,
    },
  });

  // Linhas snapshot: substitui as da fotografia (nunca acumula)
  await prisma.investmentMovement.deleteMany({
    where: { statementId: statement.id, snapshot: true },
  });
  if (snapshotLines.length > 0) {
    await prisma.investmentMovement.createMany({
      data: snapshotLines.map((e) => ({
        date: new Date(e.date + "T12:00:00Z"),
        type: e.type,
        description: e.description,
        amount: e.amount,
        fitid: e.fitid,
        snapshot: true,
        statementId: statement.id,
        userId: session.user.id,
      })),
    });
  }

  // Fluxos novos (deduplicados)
  if (fresh.length > 0) {
    await prisma.investmentMovement.createMany({
      data: fresh.map((e) => ({
        date: new Date(e.date + "T12:00:00Z"),
        type: e.type,
        description: e.description,
        amount: e.amount,
        fitid: e.fitid,
        snapshot: false,
        statementId: statement.id,
        userId: session.user.id,
      })),
    });
  }

  return Response.json({
    success: true,
    snapshotDate,
    totalValue: statement.totalValue,
    flowsImported: fresh.length,
    flowsDuplicated: duplicates,
    snapshotReplaced: !!existingStatement,
  });
}
