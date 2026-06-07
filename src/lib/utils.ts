import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#84cc16", "#a855f7",
];

export const RECEITA_CATEGORIES = [
  { name: "Taxa de Condomínio", color: "#22c55e", icon: "home" },
  { name: "Taxa Extra", color: "#14b8a6", icon: "plus-circle" },
  { name: "Multas", color: "#eab308", icon: "alert-triangle" },
  { name: "Juros", color: "#f97316", icon: "percent" },
  { name: "Aluguel de Espaços", color: "#6366f1", icon: "building" },
  { name: "Outras Receitas", color: "#84cc16", icon: "coins" },
];

export const DESPESA_CATEGORIES = [
  { name: "Água", color: "#3b82f6", icon: "droplets" },
  { name: "Energia Elétrica", color: "#eab308", icon: "zap" },
  { name: "Gás", color: "#f97316", icon: "flame" },
  { name: "Manutenção", color: "#8b5cf6", icon: "wrench" },
  { name: "Limpeza", color: "#14b8a6", icon: "sparkles" },
  { name: "Funcionários", color: "#6366f1", icon: "users" },
  { name: "Segurança", color: "#ef4444", icon: "shield" },
  { name: "Administração", color: "#ec4899", icon: "briefcase" },
  { name: "Seguro", color: "#84cc16", icon: "umbrella" },
  { name: "Jardinagem", color: "#22c55e", icon: "leaf" },
  { name: "Elevador", color: "#a855f7", icon: "arrow-up-down" },
  { name: "Outras Despesas", color: "#94a3b8", icon: "receipt" },
];
