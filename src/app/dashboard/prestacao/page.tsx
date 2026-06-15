"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, ChevronLeft, ChevronRight, Lock, Unlock,
  TrendingUp, TrendingDown, DollarSign, CheckCircle, Download,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentMonth, prevMonth, nextMonth } from "@/lib/finance";

interface Statement {
  id: string;
  month: string;
  saldoEmConta: number;
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  status: string;
  notes: string | null;
  closedAt: string | null;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  category: { name: string; color: string } | null;
}

interface MonthData {
  statement: Statement | null;
  transactions: Transaction[];
  totals: { receitas: number; despesas: number; resultado: number };
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function PrestacaoPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<MonthData | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false); // false = same as server; useEffect sets true before first fetch
  const [saldoInput, setSaldoInput] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [monthRes, listRes] = await Promise.all([
      fetch(`/api/statements/${month}`),
      fetch("/api/statements"),
    ]);
    const monthData: MonthData = await monthRes.json();
    const list: Statement[] = await listRes.json();
    setData(monthData);
    setStatements(Array.isArray(list) ? list : []);
    if (monthData.statement) {
      setSaldoInput(String(monthData.statement.saldoEmConta));
      setNotes(monthData.statement.notes ?? "");
    } else {
      setSaldoInput("");
      setNotes("");
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    const saldo = parseFloat(saldoInput.replace(",", "."));
    if (isNaN(saldo)) { setMsg("Informe o saldo em conta válido."); setSaving(false); return; }
    await fetch("/api/statements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, saldoEmConta: saldo, notes }),
    });
    await fetchData();
    setMsg("Prestação salva!");
    setSaving(false);
  }

  async function handleClose() {
    setSaving(true);
    setMsg("");
    const saldo = parseFloat(saldoInput.replace(",", "."));
    if (isNaN(saldo)) { setMsg("Informe o saldo em conta antes de fechar."); setSaving(false); return; }
    // Save first
    await fetch("/api/statements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, saldoEmConta: saldo, notes }),
    });
    await fetch(`/api/statements/${month}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", notes }),
    });
    await fetchData();
    setMsg("Prestação fechada com sucesso!");
    setSaving(false);
  }

  async function handleReopen() {
    setSaving(true);
    await fetch(`/api/statements/${month}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    await fetchData();
    setSaving(false);
  }

  async function exportPDF() {
    if (!data) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = 210;
      const PH = 297;
      const M = 15;          // margin
      const CW = PW - M * 2; // content width
      let y = M;

      // ── helpers ──────────────────────────────────────────────────────────

      function newPageIfNeeded(need: number) {
        if (y + need > PH - M) {
          pdf.addPage();
          y = M;
        }
      }

      function hline(color = "#e5e7eb") {
        pdf.setDrawColor(color);
        pdf.setLineWidth(0.2);
        pdf.line(M, y, M + CW, y);
        y += 3;
      }

      function text(
        str: string,
        x: number,
        size = 10,
        color = "#111827",
        align: "left" | "right" | "center" = "left"
      ) {
        pdf.setFontSize(size);
        pdf.setTextColor(color);
        pdf.text(str, x, y, { align });
      }

      function row(
        left: string,
        right: string,
        bold = false,
        leftColor = "#374151",
        rightColor = "#111827"
      ) {
        newPageIfNeeded(7);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setTextColor(leftColor);
        pdf.text(left, M, y);
        pdf.setTextColor(rightColor);
        pdf.text(right, M + CW, y, { align: "right" });
        y += 6;
      }

      function sectionTitle(title: string, bgColor: string) {
        newPageIfNeeded(10);
        pdf.setFillColor(bgColor);
        pdf.rect(M, y - 4, CW, 8, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor("#ffffff");
        pdf.text(title, M + 2, y + 0.5);
        y += 7;
      }

      const fmt = (v: number) =>
        "R$ " +
        v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const [yr, mo] = month.split("-").map(Number);
      const periodLabel = new Date(yr, mo - 1, 1)
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase());

      // ── Header ─────���──────────────────────────────────────────────────────

      pdf.setFillColor("#4f46e5");
      pdf.rect(0, 0, PW, 28, "F");
      pdf.setFont("helvetica", "bold");
      text("Condomínio Bela Vista — Prestação de Contas", PW / 2, 14, "#ffffff", "center");
      y = 18;
      pdf.setFont("helvetica", "normal");
      text(`Período: ${periodLabel}`, PW / 2, 9, "#c7d2fe", "center");
      y = 24;
      text(
        `Gerado em ${new Date().toLocaleString("pt-BR")}`,
        PW / 2,
        8,
        "#a5b4fc",
        "center"
      );
      y = 36;

      if (isClosed && data.statement?.closedAt) {
        pdf.setFont("helvetica", "italic");
        text(
          `Prestação fechada em ${formatDate(data.statement.closedAt)}`,
          PW / 2,
          8,
          "#6b7280",
          "center"
        );
        y += 4;
      }

      // ── Resumo ─��───────────────────────���──────────────────────────────────

      y += 2;
      pdf.setFont("helvetica", "bold");
      text("RESUMO DO PERÍODO", M, 11, "#111827");
      y += 6;
      hline();

      row("Total de Receitas", fmt(data.totals.receitas), false, "#374151", "#16a34a");
      row("Total de Despesas", fmt(data.totals.despesas), false, "#374151", "#dc2626");
      hline();
      row(
        "Resultado",
        fmt(data.totals.resultado),
        true,
        "#111827",
        data.totals.resultado >= 0 ? "#4f46e5" : "#dc2626"
      );
      if (data.statement?.saldoEmConta != null) {
        row("Saldo em Conta (extrato)", fmt(data.statement.saldoEmConta), false, "#374151", "#2563eb");
      }

      y += 4;

      // ── Receitas ─────────���──────────────────────────���─────────────────────

      if (receitas.length > 0) {
        newPageIfNeeded(14);
        sectionTitle(`RECEITAS  (${receitas.length} lançamentos)`, "#16a34a");

        // Column headers
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor("#6b7280");
        pdf.text("Data", M, y);
        pdf.text("Descrição", M + 20, y);
        pdf.text("Categoria", M + 110, y);
        pdf.text("Valor", M + CW, y, { align: "right" });
        y += 4;
        hline("#d1fae5");

        receitas.forEach((t) => {
          newPageIfNeeded(6);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor("#374151");
          pdf.text(formatDate(t.date), M, y);
          const desc = t.description.length > 50 ? t.description.slice(0, 48) + "…" : t.description;
          pdf.text(desc, M + 20, y);
          pdf.text(t.category?.name ?? "—", M + 110, y);
          pdf.setTextColor("#16a34a");
          pdf.text(fmt(t.amount), M + CW, y, { align: "right" });
          y += 5.5;
        });

        y += 2;
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor("#16a34a");
        pdf.setFontSize(9);
        pdf.text(`Total Receitas: ${fmt(data.totals.receitas)}`, M + CW, y, { align: "right" });
        y += 6;
      }

      // ── Despesas ─────────────────────────────────────────────────────────���

      if (despesas.length > 0) {
        newPageIfNeeded(14);
        sectionTitle(`DESPESAS  (${despesas.length} lançamentos)`, "#dc2626");

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor("#6b7280");
        pdf.text("Data", M, y);
        pdf.text("Descrição", M + 20, y);
        pdf.text("Categoria", M + 110, y);
        pdf.text("Valor", M + CW, y, { align: "right" });
        y += 4;
        hline("#fee2e2");

        despesas.forEach((t) => {
          newPageIfNeeded(6);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor("#374151");
          pdf.text(formatDate(t.date), M, y);
          const desc = t.description.length > 50 ? t.description.slice(0, 48) + "…" : t.description;
          pdf.text(desc, M + 20, y);
          pdf.text(t.category?.name ?? "—", M + 110, y);
          pdf.setTextColor("#dc2626");
          pdf.text(fmt(t.amount), M + CW, y, { align: "right" });
          y += 5.5;
        });

        y += 2;
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor("#dc2626");
        pdf.setFontSize(9);
        pdf.text(`Total Despesas: ${fmt(data.totals.despesas)}`, M + CW, y, { align: "right" });
        y += 6;
      }

      // ── Notes ───────────────────────────────────────���─────────────────────

      if (data.statement?.notes) {
        newPageIfNeeded(16);
        y += 2;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor("#374151");
        pdf.text("OBSERVAÇÕES", M, y);
        y += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor("#6b7280");
        const lines = pdf.splitTextToSize(data.statement.notes, CW) as string[];
        lines.forEach((l) => { newPageIfNeeded(5); pdf.text(l, M, y); y += 5; });
        y += 3;
      }

      // ── Footer on every page ──────────────────────────────────────────────

      const totalPages = (pdf as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor("#e5e7eb");
        pdf.setLineWidth(0.2);
        pdf.line(M, PH - 12, M + CW, PH - 12);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor("#9ca3af");
        pdf.text("Condomínio Bela Vista · Ibiá, MG", M, PH - 7);
        pdf.text(`Página ${i} de ${totalPages}`, M + CW, PH - 7, { align: "right" });
      }

      pdf.save(`prestacao-${month}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const isClosed = data?.statement?.status === "FECHADA";
  const receitas = data?.transactions.filter((t) => t.type === "RECEITA") ?? [];
  const despesas = data?.transactions.filter((t) => t.type === "DESPESA") ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Prestação de Contas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Consolidação mensal do Condomínio Bela Vista</p>
        </div>
        <button
          onClick={exportPDF}
          disabled={exporting || loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Gerando PDF…" : "Exportar PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: month nav + history */}
        <div className="space-y-4 print:hidden">
          {/* Month selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Período</p>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-800 text-center capitalize">
                {monthLabel(month)}
              </span>
              <button
                onClick={() => setMonth(nextMonth(month))}
                disabled={month >= currentMonth()}
                className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Histórico</p>
            <div className="space-y-1">
              {statements.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma prestação ainda</p>
              )}
              {statements.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setMonth(s.month)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    s.month === month ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="capitalize">{monthLabel(s.month)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    s.status === "FECHADA"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {s.status === "FECHADA" ? "Fechada" : "Aberta"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: main content */}
        <div id="prestacao-content" className="lg:col-span-3 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <>
              {/* Print header */}
              <div className="hidden print:block text-center mb-6">
                <h2 className="text-xl font-bold">Condomínio Bela Vista — Ibiá, MG</h2>
                <p className="text-gray-600 capitalize">Prestação de Contas — {monthLabel(month)}</p>
                {isClosed && data?.statement?.closedAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    Fechada em {formatDate(data.statement.closedAt)}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-3 print:hidden">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  isClosed
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-amber-100 text-amber-700 border border-amber-200"
                }`}>
                  {isClosed
                    ? <><CheckCircle className="w-4 h-4" /> Prestação Fechada</>
                    : <><Lock className="w-4 h-4 opacity-50" /> Em Aberto</>}
                </span>
                {data?.statement?.closedAt && (
                  <span className="text-xs text-gray-400">
                    Fechada em {formatDate(data.statement.closedAt)}
                  </span>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label="Receitas"
                  value={data?.totals.receitas ?? 0}
                  icon={<TrendingUp className="w-4 h-4 text-green-600" />}
                  color="text-green-600"
                  bg="bg-green-50"
                />
                <SummaryCard
                  label="Despesas"
                  value={data?.totals.despesas ?? 0}
                  icon={<TrendingDown className="w-4 h-4 text-red-600" />}
                  color="text-red-600"
                  bg="bg-red-50"
                />
                <SummaryCard
                  label="Resultado"
                  value={data?.totals.resultado ?? 0}
                  icon={<DollarSign className="w-4 h-4 text-indigo-600" />}
                  color={(data?.totals.resultado ?? 0) >= 0 ? "text-indigo-600" : "text-red-600"}
                  bg="bg-indigo-50"
                />
                <SummaryCard
                  label="Saldo em Conta"
                  value={data?.statement?.saldoEmConta ?? 0}
                  icon={<DollarSign className="w-4 h-4 text-blue-600" />}
                  color="text-blue-600"
                  bg="bg-blue-50"
                  highlight
                />
              </div>

              {/* Saldo em conta input */}
              {!isClosed && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
                  <h3 className="font-semibold text-gray-800 mb-4">Saldo em Conta e Observações</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Saldo real em conta (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={saldoInput}
                        onChange={(e) => setSaldoInput(e.target.value)}
                        placeholder="Ex: 2903.44"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Valor do extrato bancário ao final do período
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anotações da prestação de contas..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>

                  {msg && (
                    <p className={`text-sm mt-3 ${msg.includes("sucesso") || msg.includes("salva") ? "text-green-600" : "text-red-600"}`}>
                      {msg}
                    </p>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {saving ? "Salvando…" : "Salvar rascunho"}
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={saving || data?.transactions.length === 0}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <Lock className="w-4 h-4" />
                      {saving ? "Fechando…" : "Fechar Prestação de Contas"}
                    </button>
                  </div>
                </div>
              )}

              {isClosed && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Saldo em Conta</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(data?.statement?.saldoEmConta ?? 0)}
                      </p>
                      {data?.statement?.notes && (
                        <p className="text-sm text-gray-500 mt-2">{data.statement.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={handleReopen}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50"
                    >
                      <Unlock className="w-4 h-4" />
                      Reabrir
                    </button>
                  </div>
                </div>
              )}

              {/* Receitas */}
              {receitas.length > 0 && (
                <TransactionGroup
                  title="Receitas"
                  transactions={receitas}
                  total={data?.totals.receitas ?? 0}
                  color="green"
                />
              )}

              {/* Despesas */}
              {despesas.length > 0 && (
                <TransactionGroup
                  title="Despesas"
                  transactions={despesas}
                  total={data?.totals.despesas ?? 0}
                  color="red"
                />
              )}

              {data?.transactions.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma transação neste mês.</p>
                </div>
              )}

              {/* Print footer */}
              <div className="hidden print:block mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
                <p>Condomínio Bela Vista · Ibiá, MG · Gerado em {new Date().toLocaleDateString("pt-BR")}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg, highlight }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function TransactionGroup({ title, transactions, total, color }: {
  title: string; transactions: Transaction[]; total: number; color: "green" | "red";
}) {
  const colorMap = {
    green: { header: "bg-green-50 border-green-200", text: "text-green-700", amount: "text-green-600" },
    red: { header: "bg-red-50 border-red-200", text: "text-red-700", amount: "text-red-600" },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 border-b ${c.header}`}>
        <h3 className={`font-semibold text-sm ${c.text}`}>{title}</h3>
        <span className={`font-bold text-sm ${c.amount}`}>{formatCurrency(total)}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-2.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: t.category?.color ?? (color === "green" ? "#22c55e" : "#ef4444") }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{t.description}</p>
              {t.category && (
                <p className="text-xs text-gray-400">{t.category.name}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{formatDate(t.date)}</span>
            <span className={`text-sm font-medium shrink-0 ${c.amount}`}>
              {formatCurrency(t.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
