"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Legend,
} from "recharts";
import { Download, FileText, TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import {
  sumByType, computeResultado, ticketMedio,
  groupByCategory, groupByDay as groupByDayISO,
} from "@/lib/finance";

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  category: { name: string; color: string } | null;
}

const PRESETS = [
  {
    label: "Este mês",
    fn: () => {
      const d = new Date(); d.setDate(1);
      const start = d.toISOString().split("T")[0];
      d.setMonth(d.getMonth() + 1); d.setDate(0);
      return { start, end: d.toISOString().split("T")[0] };
    },
  },
  {
    label: "Mês anterior",
    fn: () => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
      const start = d.toISOString().split("T")[0];
      d.setMonth(d.getMonth() + 1); d.setDate(0);
      return { start, end: d.toISOString().split("T")[0] };
    },
  },
  {
    label: "3 meses",
    fn: () => {
      const today = new Date();
      const s = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return { start: s.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    },
  },
  {
    label: "6 meses",
    fn: () => {
      const today = new Date();
      const s = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return { start: s.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    },
  },
  {
    label: "12 meses",
    fn: () => {
      const today = new Date();
      const s = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { start: s.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    },
  },
  {
    label: "Este ano",
    fn: () => ({
      start: `${new Date().getFullYear()}-01-01`,
      end: new Date().toISOString().split("T")[0],
    }),
  },
];

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activePreset, setActivePreset] = useState<string>("Este mês");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/transactions?limit=2000&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => { setTransactions(d.transactions ?? []); setLoading(false); setPage(1); });
  }, [startDate, endDate]);

  function applyPreset(label: string, fn: () => { start: string; end: string }) {
    const { start, end } = fn();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(label);
  }

  const receitas = transactions.filter((t) => t.type === "RECEITA");
  const despesas = transactions.filter((t) => t.type === "DESPESA");
  // Somas e resultado sempre arredondados a 2 casas (precisão de prestação de contas)
  const totalReceitas = sumByType(transactions, "RECEITA");
  const totalDespesas = sumByType(transactions, "DESPESA");
  const saldo = computeResultado(totalReceitas, totalDespesas);
  const ticketMedioReceita = ticketMedio(totalReceitas, receitas.length);
  const ticketMedioDespesa = ticketMedio(totalDespesas, despesas.length);

  const receitaByCategory = groupByCategory(receitas);
  const despesaByCategory = groupByCategory(despesas);
  // groupByDayISO devolve a chave ISO ordenável; aqui adicionamos o rótulo pt-BR para o gráfico
  const byDay = groupByDayISO(transactions).map((d) => ({
    date: new Date(d.day + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    receitas: d.receitas,
    despesas: d.despesas,
  }));

  // Paginação da tabela em tela (a impressão sempre mostra 100% dos registros)
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = transactions.slice(pageStart, pageStart + pageSize);

  function exportExcel() {
    const rows = transactions.map((t) => ({
      Data: formatDate(t.date),
      Descrição: t.description,
      Tipo: t.type === "RECEITA" ? "Receita" : "Despesa",
      Categoria: t.category?.name ?? "—",
      "Valor (R$)": t.amount.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
    const summary = [
      { Resumo: "Total Receitas", Valor: formatCurrency(totalReceitas) },
      { Resumo: "Total Despesas", Valor: formatCurrency(totalDespesas) },
      { Resumo: "Saldo", Valor: formatCurrency(saldo) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Resumo");
    XLSX.writeFile(wb, `relatorio-${startDate}-${endDate}.xlsx`);
  }

  function exportPDF() {
    window.print();
  }

  const periodLabel = `${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} a ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;
  const generatedAt = new Date().toLocaleString("pt-BR");

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { margin: 1.5cm; size: A4; }
        }
        .print-only { display: none; }
      `}</style>

      <div id="print-report" className="space-y-6 max-w-7xl mx-auto">
        {/* Print header (only shown on print) */}
        <div className="print-only border-b pb-4 mb-2">
          <h1 className="text-xl font-bold text-gray-900">Relatório Financeiro</h1>
          <p className="text-sm text-gray-600 mt-1">Período: {periodLabel}</p>
        </div>

        {/* Screen header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-500 text-sm mt-1">Análise financeira por período</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 no-print">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset(""); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset(""); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => applyPreset(label, fn)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    activePreset === label
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 no-print">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-green-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Total Receitas</span>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitas)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {receitas.length} transações · ticket médio {formatCurrency(ticketMedioReceita)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-red-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Total Despesas</span>
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesas)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {despesas.length} transações · ticket médio {formatCurrency(ticketMedioDespesa)}
                </p>
              </div>
              <div className={`bg-white rounded-xl border p-5 ${saldo >= 0 ? "border-indigo-200" : "border-red-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Saldo do Período</span>
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                </div>
                <p className={`text-2xl font-bold ${saldo >= 0 ? "text-indigo-600" : "text-red-600"}`}>
                  {formatCurrency(saldo)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{transactions.length} transações total</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Movimentação por Dia</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(typeof v === "number" ? v : 0)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Despesas por Categoria</h3>
                {despesaByCategory.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={despesaByCategory.map((e) => ({ ...e, fill: e.color }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ percent }) =>
                            (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                          }
                        />
                        <Tooltip formatter={(v) => formatCurrency(typeof v === "number" ? v : 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {despesaByCategory.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="text-gray-600 truncate max-w-32">{c.name}</span>
                          </div>
                          <span className="font-medium text-gray-800">{formatCurrency(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    Sem despesas no período
                  </div>
                )}
              </div>
            </div>

            {/* Receitas por categoria */}
            {receitaByCategory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Receitas por Categoria</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={receitaByCategory.map((e) => ({ ...e, fill: e.color }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ percent }) =>
                          (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                        }
                      />
                      <Tooltip formatter={(v) => formatCurrency(typeof v === "number" ? v : 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 self-center">
                    {receitaByCategory.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                          <span className="text-gray-600">{c.name}</span>
                        </div>
                        <span className="font-medium text-gray-800">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transaction table — tela (paginada) */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden no-print">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold text-gray-800">
                    Todas as Transações do Período
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({transactions.length} registros)
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-xs text-gray-500">Registros por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {[25, 50, 100, 200, 300].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Descrição</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Categoria</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pageRows.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">{formatDate(t.date)}</td>
                          <td className="py-2.5 px-4 text-gray-800 max-w-xs truncate">{t.description}</td>
                          <td className="py-2.5 px-4">
                            {t.category ? (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: t.category.color + "20", color: t.category.color }}
                              >
                                {t.category.name}
                              </span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className={`py-2.5 px-4 text-right font-semibold ${t.type === "RECEITA" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "RECEITA" ? "+" : "-"}{formatCurrency(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginação */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-gray-500">
                    Exibindo {pageStart + 1}–{Math.min(pageStart + pageSize, transactions.length)} de {transactions.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 2)
                      .map((n, idx, arr) => (
                        <span key={n} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== n - 1 && (
                            <span className="px-1 text-gray-400 text-xs">…</span>
                          )}
                          <button
                            onClick={() => setPage(n)}
                            className={`min-w-8 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              n === currentPage
                                ? "bg-indigo-600 text-white"
                                : "text-gray-600 border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {n}
                          </button>
                        </span>
                      ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próxima página"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction table — impressão (todos os registros, sem paginação) */}
            {transactions.length > 0 && (
              <div className="print-only">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Todas as Transações do Período ({transactions.length} registros)
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Data</th>
                      <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Descrição</th>
                      <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Categoria</th>
                      <th className="text-right py-1.5 font-medium text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-200" style={{ breakInside: "avoid" }}>
                        <td className="py-1 pr-2 text-gray-600 whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="py-1 pr-2 text-gray-800">{t.description}</td>
                        <td className="py-1 pr-2 text-gray-600">{t.category?.name ?? "—"}</td>
                        <td className={`py-1 text-right font-semibold ${t.type === "RECEITA" ? "text-green-700" : "text-red-700"}`}>
                          {t.type === "RECEITA" ? "+" : "-"}{formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan={3} className="py-1.5 pr-2 text-gray-700">
                        Total: {receitas.length} receitas ({formatCurrency(totalReceitas)}) · {despesas.length} despesas ({formatCurrency(totalDespesas)})
                      </td>
                      <td className={`py-1.5 text-right ${saldo >= 0 ? "text-indigo-700" : "text-red-700"}`}>
                        Saldo: {formatCurrency(saldo)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Print footer */}
            <div className="print-only border-t pt-3 mt-4 text-xs text-gray-400 flex justify-between">
              <span>Bela Vista — Gestão Financeira</span>
              <span>Gerado em {generatedAt}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}

