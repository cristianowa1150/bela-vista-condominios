"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Upload, FileText, AlertCircle, CheckCircle, X,
  History, DollarSign, Calendar, Trash2, AlertTriangle,
  RefreshCw, ShieldAlert,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PreviewTransaction {
  date: string;
  description: string;
  amount: number;
  type: string;
}

interface BankMetadata {
  saldo?: number;
  periodEnd?: string;
  periodLabel?: string;
  conta?: string;
}

interface PeriodConflict {
  month: string;
  existingCount: number;
}

interface AlreadyImported {
  filename: string;
  importedAt: string;
}

interface ImportHistory {
  id: string;
  filename: string;
  fileType: string;
  recordCount: number;
  status: string;
  createdAt: string;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<PreviewTransaction[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewMeta, setPreviewMeta] = useState<BankMetadata | null>(null);
  const [periodConflict, setPeriodConflict] = useState<PeriodConflict | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [alreadyImported, setAlreadyImported] = useState<AlreadyImported | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<{ imported: number; duplicatesSkipped?: number; metadata?: BankMetadata; replaced?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ImportHistory[]>([]);

  // Clear data state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<"imported" | "all">("imported");
  const [clearConfirm, setClearConfirm] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch("/api/import").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setHistory(d);
    });
  }, [success, clearing]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) await loadFile(dropped);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await loadFile(f);
  };

  async function loadFile(f: File) {
    setFile(f);
    setPreview(null);
    setSuccess(null);
    setError("");
    setPreviewErrors([]);
    setPreviewMeta(null);
    setPeriodConflict(null);
    setNewCount(0);
    setDuplicateCount(0);
    setAlreadyImported(null);

    const formData = new FormData();
    formData.set("file", f);
    formData.set("previewOnly", "true");

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setPreview(data.preview);
      setPreviewTotal(data.total);
      setPreviewErrors(data.errors ?? []);
      setPreviewMeta(data.metadata ?? null);
      setPeriodConflict(data.periodConflict ?? null);
      setNewCount(data.newCount ?? data.total);
      setDuplicateCount(data.duplicateCount ?? 0);
      setAlreadyImported(data.alreadyImported ?? null);
    } else {
      setError(data.error ?? "Erro ao processar arquivo");
    }
  }

  async function handleImport(replaceMode = false) {
    if (!file) return;
    setImporting(true);
    setError("");

    const formData = new FormData();
    formData.set("file", file);
    if (replaceMode) formData.set("replaceMode", "true");

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setSuccess({
        imported: data.imported,
        duplicatesSkipped: data.duplicatesSkipped,
        metadata: data.metadata,
        replaced: data.replaced,
      });
      setPreview(null);
      setFile(null);
      setPreviewMeta(null);
      setPeriodConflict(null);
      setAlreadyImported(null);
    } else {
      setError(data.error ?? "Erro ao importar");
      // Importação totalmente bloqueada por duplicidade: fecha o preview
      if (data.reason === "DUPLICATE_FILE" || data.reason === "ALL_DUPLICATES") {
        setPreview(null);
        setFile(null);
        setPreviewMeta(null);
        setPeriodConflict(null);
        setAlreadyImported(null);
      }
    }
    setImporting(false);
  }

  async function handleClearData() {
    if (clearConfirm !== "CONFIRMAR") return;
    setClearing(true);
    const res = await fetch("/api/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: clearScope }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowClearModal(false);
      setClearConfirm("");
      setSuccess({
        imported: 0,
        metadata: undefined,
      });
      setPreview(null);
      setFile(null);
      alert(
        `Dados removidos: ${data.deleted.transactions} transações, ${data.deleted.imports} importações, ${data.deleted.statements} prestações.`
      );
    } else {
      alert(data.error ?? "Erro ao limpar dados");
    }
    setClearing(false);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setPreviewErrors([]);
    setPreviewMeta(null);
    setPeriodConflict(null);
    setNewCount(0);
    setDuplicateCount(0);
    setAlreadyImported(null);
    setSuccess(null);
    setError("");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Transações</h1>
        <p className="text-gray-500 text-sm mt-1">
          Importe extratos bancários em CSV ou XLSX
        </p>
      </div>

      {/* Success */}
      {success && success.imported > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">
                {success.replaced ? "Substituição concluída — " : ""}
                {success.imported} transações importadas com sucesso!
              </p>
              {(success.duplicatesSkipped ?? 0) > 0 && (
                <p className="text-amber-700 text-sm mt-1">
                  {success.duplicatesSkipped} transações duplicadas foram detectadas e{" "}
                  <strong>não foram importadas</strong> (já existiam no sistema com a mesma data,
                  valor e descrição).
                </p>
              )}
              {success.metadata?.saldo !== undefined && success.metadata.periodEnd && (
                <p className="text-green-700 text-sm mt-1">
                  Saldo da conta{" "}
                  <strong>{formatCurrency(success.metadata.saldo)}</strong> registrado
                  automaticamente na Prestação de Contas de{" "}
                  <strong className="capitalize">{monthLabel(success.metadata.periodEnd)}</strong>.
                </p>
              )}
            </div>
            <button onClick={reset} className="text-green-600 hover:text-green-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      {!preview && !success && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragOver
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-white hover:border-indigo-400"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-lg">Arraste o arquivo aqui</p>
              <p className="text-gray-500 text-sm mt-1">ou clique para selecionar</p>
            </div>
            <label className="cursor-pointer px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Selecionar Arquivo
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400">
              Formatos suportados: CSV, XLSX, XLS · Extratos do Internet Banking
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!preview && !success && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-800 mb-3 text-sm">Como exportar o extrato</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-blue-700">
            <div>
              <p className="font-medium mb-1">Bradesco / Itaú / BB / Inter</p>
              <p className="text-blue-600">Internet Banking → Conta Corrente → Extrato → Exportar → CSV</p>
            </div>
            <div>
              <p className="font-medium mb-1">Caixa Econômica</p>
              <p className="text-blue-600">Internet Banking → Extrato → Período → Download CSV</p>
            </div>
            <div>
              <p className="font-medium mb-1">Sicoob / Sicredi</p>
              <p className="text-blue-600">Portal → Movimentação → Exportar → Planilha Excel</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">Pré-visualização</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium text-indigo-600">{previewTotal} transações</span> detectadas
                  {preview.length < previewTotal && ` (mostrando primeiras ${preview.length})`}
                  {file && <span className="ml-2 text-gray-400">· {file.name}</span>}
                </p>
              </div>
              <button onClick={reset} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bank metadata */}
            {previewMeta && (previewMeta.saldo !== undefined || previewMeta.periodLabel) && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  Dados detectados no extrato
                </p>
                <div className="flex flex-wrap gap-4">
                  {previewMeta.periodLabel && (
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>Período: <strong>{previewMeta.periodLabel}</strong></span>
                    </div>
                  )}
                  {previewMeta.saldo !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      <span>Saldo em conta: <strong>{formatCurrency(previewMeta.saldo)}</strong></span>
                    </div>
                  )}
                </div>
                {previewMeta.saldo !== undefined && previewMeta.periodEnd && (
                  <p className="text-xs text-blue-600 mt-2">
                    ✓ Saldo será salvo automaticamente na Prestação de Contas de{" "}
                    <span className="font-medium capitalize">{monthLabel(previewMeta.periodEnd)}</span>.
                  </p>
                )}
              </div>
            )}

            {/* Arquivo idêntico já importado */}
            {alreadyImported && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">
                      Este arquivo já foi importado
                    </p>
                    <p className="text-red-700 text-xs mt-1">
                      Conteúdo idêntico a <strong>{alreadyImported.filename}</strong>, importado em{" "}
                      {new Date(alreadyImported.importedAt).toLocaleString("pt-BR")}. A importação
                      normal está bloqueada para evitar duplicidade.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Análise de duplicidade */}
            {!alreadyImported && duplicateCount > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      {newCount === 0
                        ? `Todas as ${previewTotal} transações deste extrato já existem no sistema`
                        : `${duplicateCount} de ${previewTotal} transações já existem no sistema`}
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      {newCount === 0 ? (
                        <>Nada será importado — a importação está bloqueada para garantir a exatidão
                        da prestação de contas.</>
                      ) : (
                        <>As duplicadas serão <strong>automaticamente ignoradas</strong> (mesma data,
                        valor e descrição). Apenas as <strong>{newCount} transações novas</strong>{" "}
                        serão importadas — ideal para complementar um mês ainda em aberto com
                        extratos parciais (5, 15, 30 dias ou personalizado).</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Período com dados, mas sem nenhuma duplicata */}
            {periodConflict && duplicateCount === 0 && !alreadyImported && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-800 text-sm">
                      {periodConflict.existingCount} transações já existem em{" "}
                      <span className="capitalize">{monthLabel(periodConflict.month)}</span>
                    </p>
                    <p className="text-blue-700 text-xs mt-1">
                      Nenhuma coincide com este extrato — as {previewTotal} transações serão{" "}
                      <strong>adicionadas</strong> ao mês. Use "Substituir Período" apenas se quiser
                      apagar tudo do mês e reimportar do zero.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Errors */}
            {previewErrors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-medium text-yellow-800 mb-1">
                  {previewErrors.length} linhas ignoradas:
                </p>
                {previewErrors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-xs text-yellow-700">{e}</p>
                ))}
                {previewErrors.length > 3 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ... e mais {previewErrors.length - 3} erros
                  </p>
                )}
              </div>
            )}

            {/* Transaction table */}
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Descrição</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="py-2 px-3 text-gray-800 max-w-xs truncate">{t.description}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.type === "RECEITA"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {t.type === "RECEITA" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${
                        t.type === "RECEITA" ? "text-green-600" : "text-red-600"
                      }`}>
                        {t.type === "RECEITA" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={reset}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>

            {periodConflict ? (
              <>
                <button
                  onClick={() => handleImport(true)}
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  {importing ? "Substituindo…" : `Substituir ${monthLabel(periodConflict.month)}`}
                </button>
                <button
                  onClick={() => handleImport(false)}
                  disabled={importing || newCount === 0 || !!alreadyImported}
                  title={
                    alreadyImported
                      ? "Arquivo idêntico já importado"
                      : newCount === 0
                        ? "Todas as transações já existem no sistema"
                        : undefined
                  }
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {importing
                    ? "Importando…"
                    : newCount === 0 || alreadyImported
                      ? "Nada novo a importar"
                      : duplicateCount > 0
                        ? `Importar ${newCount} novas (ignorar ${duplicateCount} duplicadas)`
                        : `Mesclar (adicionar ${previewTotal} transações)`}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleImport(false)}
                disabled={importing || newCount === 0 || !!alreadyImported}
                title={
                  alreadyImported
                    ? "Arquivo idêntico já importado"
                    : newCount === 0
                      ? "Todas as transações já existem no sistema"
                      : undefined
                }
                className="flex-1 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {importing
                  ? "Importando…"
                  : newCount === 0 || alreadyImported
                    ? "Nada novo a importar"
                    : duplicateCount > 0
                      ? `Importar ${newCount} novas (ignorar ${duplicateCount} duplicadas)`
                      : `Importar ${previewTotal} transações`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Import history */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-800">Histórico de Importações</h3>
          </div>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-4 py-2.5 px-3 bg-gray-50 rounded-lg text-sm">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="flex-1 text-gray-800 truncate">{h.filename}</span>
                <span className="text-gray-500 shrink-0">{h.recordCount} registros</span>
                <span className="text-gray-400 text-xs shrink-0">{formatDate(h.createdAt)}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                  h.status === "SUCCESS"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {h.status === "SUCCESS" ? "OK" : "Erro"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Danger Zone ───────────────────────────────────── */}
      <div className="border border-red-200 rounded-xl p-5 bg-red-50">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 mb-1">Limpar Dados</h3>
            <p className="text-red-700 text-sm mb-4">
              Use quando precisar reimportar os extratos do zero. Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setClearScope("imported"); setShowClearModal(true); setClearConfirm(""); }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Limpar dados importados
              </button>
              <button
                onClick={() => { setClearScope("all"); setShowClearModal(true); setClearConfirm(""); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Limpar tudo (incluindo manuais)
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-red-600">
              <p>
                <strong>Importados:</strong> remove transações via CSV/XLSX, histórico de
                importações e prestações de contas.
              </p>
              <p>
                <strong>Tudo:</strong> remove também lançamentos manuais. Categorias e usuários são
                preservados.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clear confirmation modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {clearScope === "all" ? "Limpar Todos os Dados" : "Limpar Dados Importados"}
                </h3>
                <p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 text-sm text-red-700">
              {clearScope === "all"
                ? "Serão removidos: todas as transações (importadas e manuais), todo o histórico de importações e todas as prestações de contas."
                : "Serão removidos: transações importadas via CSV/XLSX, histórico de importações e prestações de contas. Lançamentos manuais serão preservados."}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Digite <strong>CONFIRMAR</strong> para prosseguir:
              </label>
              <input
                type="text"
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                placeholder="CONFIRMAR"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowClearModal(false); setClearConfirm(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearData}
                disabled={clearConfirm !== "CONFIRMAR" || clearing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {clearing ? "Limpando…" : "Confirmar e Limpar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
