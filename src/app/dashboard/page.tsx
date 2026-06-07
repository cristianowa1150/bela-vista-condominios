"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
} from "recharts";

type Period = "default" | "current" | "prev" | "3m" | "6m" | "12m" | "custom";

interface DashboardData {
  selectedStart: string;
  selectedEnd: string;
  availableMonths: string[];
  groupByDay: boolean;
  currentMonth: { receitas: number; despesas: number; saldo: number };
  allTime: { receitas: number; despesas: number; saldo: number };
  saldoEmConta: number | null;
  lastStatementMonth: string | null;
  periodData: Array<{ label: string; receitas: number; despesas: number; saldo: number }>;
  categoryData: Array<{ name: string; color: string; type: string; value: number }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    date: string;
    category?: { name: string; color: string } | null;
  }>;
}

const fmt = (d: Date) => d.toISOString().split("T")[0];

function periodToDates(period: Period, customStart: string, customEnd: string) {
  const today = new Date();
  switch (period) {
    case "current":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
        endDate: fmt(today),
      };
    case "prev": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: fmt(s), endDate: fmt(e) };
    }
    case "3m":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
        endDate: fmt(today),
      };
    case "6m":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
        endDate: fmt(today),
      };
    case "12m":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 11, 1)),
        endDate: fmt(today),
      };
    case "custom":
      return customStart && customEnd ? { startDate: customStart, endDate: customEnd } : null;
    default:
      return null;
  }
}

function fmtPeriodLabel(start: string, end: string) {
  const s = new Date(start + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const e = new Date(end + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

const fmtTooltip = (v: unknown) => formatCurrency(typeof v === "number" ? v : 0);

const PERIOD_BUTTONS: { key: Period; label: string }[] = [
  { key: "current", label: "Mês Atual" },
  { key: "prev", label: "Mês Anterior" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "custom", label: "Personalizado" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("default");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    const dates = periodToDates(period, customStart, customEnd);
    if (period === "custom" && !dates) return; // wait for user to fill dates

    const url = dates
      ? `/api/dashboard?startDate=${dates.startDate}&endDate=${dates.endDate}`
      : "/api/dashboard";

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Seed custom inputs on first load so they reflect actual data
        if (period === "default") {
          setCustomStart(d.selectedStart);
          setCustomEnd(d.selectedEnd);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, customStart, customEnd]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <AlertCircle className="w-5 h-5" />
        <span>Erro ao carregar dados</span>
      </div>
    );
  }

  const {
    currentMonth,
    saldoEmConta,
    lastStatementMonth,
    periodData,
    categoryData,
    recentTransactions,
    selectedStart,
    selectedEnd,
  } = data;

  const receitaCategories = categoryData.filter((c) => c.type === "RECEITA");
  const despesaCategories = categoryData.filter((c) => c.type === "DESPESA");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {fmtPeriodLabel(selectedStart, selectedEnd)}
          </p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Nova Transação
        </Link>
      </div>

      {/* Period filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                period === key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap gap-3 items-end pt-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data inicial</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data final</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receitas (período)"
          value={currentMonth.receitas}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
          border="border-green-200"
          textColor="text-green-700"
        />
        <SummaryCard
          title="Despesas (período)"
          value={currentMonth.despesas}
          icon={<TrendingDown className="w-5 h-5 text-red-600" />}
          bg="bg-red-50"
          border="border-red-200"
          textColor="text-red-700"
        />
        <SummaryCard
          title="Resultado (período)"
          value={currentMonth.saldo}
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
          border="border-indigo-200"
          textColor={currentMonth.saldo >= 0 ? "text-indigo-700" : "text-red-700"}
        />
        <Link href="/dashboard/prestacao" className="block">
          <SummaryCard
            title={
              saldoEmConta !== null
                ? `Saldo em Conta${lastStatementMonth ? ` (${lastStatementMonth})` : ""}`
                : "Saldo em Conta"
            }
            value={saldoEmConta ?? 0}
            icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            bg="bg-blue-50"
            border="border-blue-300"
            textColor="text-blue-700"
            subtitle={saldoEmConta === null ? "Registre na Prestação de Contas →" : undefined}
          />
        </Link>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            Receitas vs Despesas
            <span className="text-xs font-normal text-gray-400 ml-2">
              ({data.groupByDay ? "por dia" : "por mês"})
            </span>
          </h3>
          {periodData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={periodData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Evolução do Saldo</h3>
          {periodData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={periodData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={fmtTooltip} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {receitaCategories.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Receitas por Categoria</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={receitaCategories.map((e) => ({ ...e, fill: e.color }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ percent }) =>
                    (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                  }
                />
                <Tooltip formatter={fmtTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {receitaCategories.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-gray-600 truncate max-w-[120px]">{c.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {despesaCategories.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Despesas por Categoria</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={despesaCategories.map((e) => ({ ...e, fill: e.color }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ percent }) =>
                    (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                  }
                />
                <Tooltip formatter={fmtTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {despesaCategories.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-gray-600 truncate max-w-[120px]">{c.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transações Recentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Últimas Transações</h3>
            <Link
              href="/dashboard/transactions"
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Nenhuma transação registrada
              </p>
            ) : (
              recentTransactions.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background:
                        t.category?.color ?? (t.type === "RECEITA" ? "#22c55e" : "#ef4444"),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{t.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ${
                      t.type === "RECEITA" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "RECEITA" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/40 flex items-center justify-center z-10 pointer-events-none">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  bg,
  border,
  textColor,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  border: string;
  textColor: string;
  subtitle?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border ${border} p-5 hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium leading-tight">{title}</span>
        <div
          className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>{formatCurrency(value)}</p>
      {subtitle && <p className="text-xs text-blue-400 mt-1">{subtitle}</p>}
    </div>
  );
}
