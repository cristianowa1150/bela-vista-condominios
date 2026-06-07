"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Legend,
} from "recharts";
import { Download, FileText, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import * as XLSX from "xlsx";

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
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/transactions?limit=2000&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => { setTransactions(d.transactions ?? []); setLoading(false); });
  }, [startDate, endDate]);

  function applyPreset(label: string, fn: () => { start: string; end: string }) {
    const { start, end } = fn();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(label);
  }

  const receitas = transactions.filter((t) => t.type === "RECEITA");
  const despesas = transactions.filter((t) => t.type === "DESPESA");
  const totalReceitas = receitas.reduce((s, t) => s + t.amount, 0);
  const totalDespesas = despesas.reduce((s, t) => s + t.amount, 0);
  const saldo = totalReceitas - totalDespesas;
  const ticketMedioReceita = receitas.length ? totalReceitas / receitas.length : 0;
  const ticketMedioDespesa = despesas.length ? totalDespesas / despesas.length : 0;

  const receitaByCategory = groupByCategory(receitas);
  const despesaByCategory = groupByCategory(despesas);
  const byDay = groupByDay(transactions);

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

            {/* Transaction table */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">
                    Todas as Transações do Período
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({transactions.length} registros)
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Descrição</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Categoria</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {transactions.map((t) => (
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

function groupByCategory(txs: Transaction[]) {
  const map: Record<string, { name: string; color: string; value: number }> = {};
  txs.forEach((t) => {
    const key = t.category?.name ?? "Sem categoria";
    if (!map[key]) map[key] = { name: key, color: t.category?.color ?? "#94a3b8", value: 0 };
    map[key].value += t.amount;
  });
  return Object.values(map).sort((a, b) => b.value - a.value);
}

function groupByDay(txs: Transaction[]) {
  const map: Record<string, { date: string; receitas: number; despesas: number }> = {};
  txs.forEach((t) => {
    const date = t.date.split("T")[0];
    const label = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    if (!map[date]) map[date] = { date: label, receitas: 0, despesas: 0 };
    if (t.type === "RECEITA") map[date].receitas += t.amount;
    else map[date].despesas += t.amount;
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}
