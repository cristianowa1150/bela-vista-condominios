"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PiggyBank, Upload, TrendingUp, Landmark, ReceiptText, Wallet,
  CheckCircle, AlertCircle, X, FileText, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, LabelList,
} from "recharts";

interface SnapshotLine { type: string; description: string; amount: number }

interface InvestmentData {
  latest: {
    date: string;
    totalValue: number;
    principal: number;
    rendimento: number;
    irPrevisto: number;
    iofPrevisto: number;
    liquidoEstimado: number;
    fonte: "POSICAO" | "CALCULADO";
    divergenciaPrincipal: number;
    filename: string;
    snapshotLines: SnapshotLine[];
  } | null;
  evolution: Array<{ date: string; totalValue: number; rendimento: number }>;
  totals: { aplicado: number; resgatado: number };
  movements: Array<{ id: string; date: string; type: string; description: string; amount: number; source: string }>;
}

interface Preview {
  snapshotDate: string;
  totalValue: number | null;
  rendimento: number;
  irPrevisto: number;
  iofPrevisto: number;
  snapshotLines: number;
  flowsTotal: number;
  flowsNew: number;
  flowsDuplicated: number;
  willReplaceSnapshot: boolean;
  alreadyImported: { filename: string; importedAt: string } | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  APLICACAO:    { label: "Aplicação",        color: "text-green-600" },
  RESGATE:      { label: "Resgate",          color: "text-amber-600" },
  RENDIMENTO:   { label: "Rendimento",       color: "text-emerald-600" },
  IR_PREVISTO:  { label: "I.R. previsto",    color: "text-red-500" },
  IOF_PREVISTO: { label: "I.O.F. previsto",  color: "text-red-400" },
  OUTRO:        { label: "Outro",            color: "text-gray-500" },
};

const fmtTooltip = (v: unknown) => formatCurrency(typeof v === "number" ? v : 0);

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default function InvestmentsPage() {
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<string>("");
  const [error, setError] = useState("");

  const loadData = useCallback(() => {
    fetch("/api/investments")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setSuccess("");
    setError("");

    const fd = new FormData();
    fd.set("file", f);
    fd.set("previewOnly", "true");
    const res = await fetch("/api/investments/import", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) setPreview(d);
    else setError(d.error ?? "Erro ao processar arquivo");
    e.target.value = "";
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/investments/import", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) {
      setSuccess(
        `Extrato de ${formatDate(d.snapshotDate)} importado — posição ${formatCurrency(d.totalValue)}` +
        (d.flowsImported > 0 ? `, ${d.flowsImported} movimentações novas` : "") +
        (d.flowsDuplicated > 0 ? `, ${d.flowsDuplicated} duplicadas ignoradas` : "") +
        (d.snapshotReplaced ? " (fotografia da data atualizada)" : "")
      );
      setPreview(null);
      setFile(null);
      loadData();
    } else {
      setError(d.error ?? "Erro ao importar");
      if (d.reason === "DUPLICATE_FILE") { setPreview(null); setFile(null); }
    }
    setImporting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const latest = data?.latest ?? null;
  const evolution = data?.evolution ?? [];
  const movements = data?.movements ?? [];
  const totals = data?.totals ?? { aplicado: 0, resgatado: 0 };

  // Principal líquido vem da API: Σ aplicações − Σ resgates (extrato da conta + DTVM)
  const principal = latest ? Math.max(0, latest.principal) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-600" />
            Investimentos
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Renda fixa — consolidado dos extratos DTVM
            {latest && <> · último extrato: <strong>{formatDate(latest.date)}</strong></>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Upload className="w-4 h-4" />
            Extrato Importado (OFX)
            <input type="file" accept=".ofx,.txt" className="hidden" onChange={handleFile} />
          </label>
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors">
            <FileText className="w-4 h-4" />
            Posição de Investimentos (PDF)
            <input type="file" accept=".pdf" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm flex-1">{success}</p>
          <button onClick={() => setSuccess("")} className="text-green-600"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Preview da importação */}
      {preview && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Pré-visualização — {file?.name}
            </h3>
            <button onClick={() => { setPreview(null); setFile(null); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {preview.alreadyImported ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Este arquivo é idêntico a <strong>{preview.alreadyImported.filename}</strong>, importado em{" "}
              {new Date(preview.alreadyImported.importedAt).toLocaleString("pt-BR")}. Importação bloqueada.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Data do extrato</p>
                  <p className="font-semibold text-gray-800">{formatDate(preview.snapshotDate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Saldo conta no arquivo (informativo)</p>
                  <p className="font-semibold text-gray-600">
                    {preview.totalValue !== null ? formatCurrency(preview.totalValue) : "—"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Rendimento acumulado</p>
                  <p className="font-semibold text-gray-800">{formatCurrency(preview.rendimento)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">IR + IOF previstos</p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(preview.irPrevisto + preview.iofPrevisto)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  • {preview.snapshotLines} linhas de fotografia (rendimento/impostos acumulados) —{" "}
                  {preview.willReplaceSnapshot
                    ? "substituirão a fotografia existente desta data"
                    : "nova fotografia"}
                </p>
                <p>
                  • {preview.flowsTotal} movimentações (aplicações/resgates):{" "}
                  <strong>{preview.flowsNew} novas</strong>
                  {preview.flowsDuplicated > 0 && <>, {preview.flowsDuplicated} duplicadas serão ignoradas</>}
                </p>
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {importing ? "Importando…" : "Confirmar Importação"}
              </button>
            </>
          )}
        </div>
      )}

      {!latest ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <PiggyBank className="w-10 h-10 mx-auto mb-3" />
          <p className="font-medium text-gray-600">Nenhum extrato de investimento importado</p>
          <p className="text-sm mt-1">Importe o extrato OFX da DTVM para começar.</p>
        </div>
      ) : (
        <>
          {/* Conferência cruzada: posição oficial × fluxos da conta */}
          {latest.fonte === "POSICAO" && Math.abs(latest.divergenciaPrincipal) > 0.01 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                <strong>Conferência:</strong> o valor aplicado oficial ({formatCurrency(latest.principal)})
                difere em <strong>{formatCurrency(Math.abs(latest.divergenciaPrincipal))}</strong> das
                aplicações registradas nas Transações ({formatCurrency(latest.principal - latest.divergenciaPrincipal)}).
                {latest.divergenciaPrincipal > 0
                  ? " Provável extrato da conta corrente faltando — importe o período inicial em Importar."
                  : " Verifique lançamentos duplicados nas Transações."}
              </p>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title={`Posição Total (${formatDate(latest.date)})`} value={latest.totalValue}
              icon={<Landmark className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" border="border-emerald-200" color="text-emerald-700"
              subtitle={
                latest.fonte === "POSICAO"
                  ? `extrato oficial de posição · aplicado ${formatCurrency(latest.principal)} + rendimento ${formatCurrency(latest.rendimento)}`
                  : `calculado: aplicações − resgates + rendimento (${formatCurrency(latest.principal)} + ${formatCurrency(latest.rendimento)})`
              } />
            <Card title="Rendimento Acumulado" value={latest.rendimento}
              icon={<TrendingUp className="w-5 h-5 text-green-600" />} bg="bg-green-50" border="border-green-200" color="text-green-700" />
            <Card title="IR + IOF Previstos" value={latest.irPrevisto + latest.iofPrevisto}
              icon={<ReceiptText className="w-5 h-5 text-red-500" />} bg="bg-red-50" border="border-red-200" color="text-red-600"
              subtitle={`IR ${formatCurrency(latest.irPrevisto)} · IOF ${formatCurrency(latest.iofPrevisto)}`} />
            <Card title="Líquido Estimado (resgate total)" value={latest.liquidoEstimado}
              icon={<Wallet className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-50" border="border-indigo-200" color="text-indigo-700" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Evolução patrimonial */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
              <h3 className="font-semibold text-gray-800 mb-4">
                Evolução Patrimonial
                <span className="text-xs font-normal text-gray-400 ml-2">(posição por extrato)</span>
              </h3>
              {evolution.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">Sem extratos</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={evolution.map((e) => ({ ...e, label: monthLabel(e.date) }))}
                    margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip formatter={fmtTooltip} labelFormatter={(l) => `Extrato ${l}`} />
                    <Bar dataKey="totalValue" name="Posição" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      <LabelList
                        dataKey="totalValue"
                        position="top"
                        formatter={(v) =>
                          typeof v === "number"
                            ? v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toFixed(0)
                            : String(v ?? "")
                        }
                        style={{ fontSize: 11, fill: "#059669", fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Composição: principal vs rendimento */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                Composição da Posição
                <span className="text-xs font-normal text-gray-400 ml-2">(último extrato)</span>
              </h3>
              <div className="relative">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Principal", value: principal, fill: "#0ea5e9" },
                        { name: "Rendimento", value: latest.rendimento, fill: "#10b981" },
                      ]}
                      dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={0}
                    />
                    <Tooltip formatter={fmtTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-gray-400 leading-none">Total</span>
                  <span className="text-sm font-bold text-emerald-700 leading-tight">
                    {formatCurrency(latest.totalValue)}
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <Row color="#0ea5e9" label="Principal" value={principal} total={latest.totalValue} />
                <Row color="#10b981" label="Rendimento" value={latest.rendimento} total={latest.totalValue} />
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" />
                  Aplicado: <strong>{formatCurrency(totals.aplicado)}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-amber-500" />
                  Resgatado: <strong>{formatCurrency(totals.resgatado)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Movimentações + detalhe da fotografia */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Movimentações (aplicações e resgates)</h3>
              </div>
              {movements.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">
                  Nenhuma movimentação nos extratos importados
                </p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {movements.map((m) => {
                    const cfg = TYPE_LABELS[m.type] ?? TYPE_LABELS.OUTRO;
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                        <span className="text-gray-500 text-xs whitespace-nowrap">{formatDate(m.date)}</span>
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="flex-1 text-gray-700 truncate">{m.description}</span>
                        <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1 py-0.5 whitespace-nowrap">
                          {m.source === "CONTA" ? "extrato conta" : "extrato DTVM"}
                        </span>
                        <span className={`font-semibold ${m.type === "RESGATE" ? "text-amber-600" : "text-green-600"}`}>
                          {m.type === "RESGATE" ? "-" : "+"}{formatCurrency(m.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">
                  Detalhe do Último Extrato
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    ({latest.filename} · {formatDate(latest.date)})
                  </span>
                </h3>
              </div>
              {latest.snapshotLines.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">Sem linhas acumuladas no extrato</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {latest.snapshotLines.map((l, i) => {
                    const cfg = TYPE_LABELS[l.type] ?? TYPE_LABELS.OUTRO;
                    const negative = l.type === "IR_PREVISTO" || l.type === "IOF_PREVISTO";
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                        <span className={`text-xs font-medium whitespace-nowrap ${cfg.color}`}>{cfg.label}</span>
                        <span className="flex-1 text-gray-600 truncate text-xs">{l.description}</span>
                        <span className={`font-semibold ${negative ? "text-red-500" : "text-emerald-600"}`}>
                          {negative ? "-" : "+"}{formatCurrency(l.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            <strong>Metodologia:</strong> Posição Total = aplicações − resgates + rendimento acumulado.
            O principal vem dos lançamentos de APLICAÇÃO/RESGATE do extrato da conta corrente (importados
            em Transações) e dos extratos DTVM, com deduplicação entre as fontes; rendimento, IR e IOF vêm
            sempre do extrato DTVM mais recente (acumulados na data — nunca somados entre importações).
            O saldo (LEDGERBAL) do arquivo OFX da DTVM é ignorado por refletir a conta corrente, não a carteira.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ title, value, icon, bg, border, color, subtitle }: {
  title: string; value: number; icon: React.ReactNode;
  bg: string; border: string; color: string; subtitle?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${border} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium leading-tight">{title}</span>
        <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function Row({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-400">({total > 0 ? ((value / total) * 100).toFixed(1) : "0"}%)</span>
      </div>
      <span className="font-medium text-gray-800">{formatCurrency(value)}</span>
    </div>
  );
}
