"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateInput } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface TransactionFormProps {
  transactionId?: string;
  initialData?: {
    type: string;
    description: string;
    amount: number;
    date: string;
    categoryId?: string | null;
    notes?: string | null;
  };
}

export default function TransactionForm({ transactionId, initialData }: TransactionFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    type: initialData?.type ?? "RECEITA",
    description: initialData?.description ?? "",
    amount: initialData?.amount ? String(initialData.amount) : "",
    date: initialData?.date
      ? formatDateInput(initialData.date)
      : formatDateInput(new Date().toISOString()),
    categoryId: initialData?.categoryId ?? "",
    notes: initialData?.notes ?? "",
  });

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = {
      type: form.type,
      description: form.description.trim(),
      amount: parseFloat(form.amount.replace(",", ".")),
      date: form.date,
      categoryId: form.categoryId || null,
      notes: form.notes.trim() || null,
    };

    if (!body.description || isNaN(body.amount) || body.amount <= 0) {
      setError("Preencha todos os campos obrigatórios corretamente.");
      setLoading(false);
      return;
    }

    const url = transactionId
      ? `/api/transactions/${transactionId}`
      : "/api/transactions";
    const method = transactionId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/dashboard/transactions");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Erro ao salvar transação");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "RECEITA", categoryId: "" }))}
            className={`py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
              form.type === "RECEITA"
                ? "bg-green-50 border-green-500 text-green-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            + Receita
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "DESPESA", categoryId: "" }))}
            className={`py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
              form.type === "DESPESA"
                ? "bg-red-50 border-red-500 text-red-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            - Despesa
          </button>
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição *
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Ex: Pagamento taxa condominial - Apt 101"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>

      {/* Valor e Data */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor (R$) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0,00"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data *
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
      </div>

      {/* Categoria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categoria
        </label>
        <select
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">Sem categoria</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filteredCategories.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Nenhuma categoria cadastrada para {form.type === "RECEITA" ? "receitas" : "despesas"}.{" "}
            <a href="/dashboard/categories" className="text-indigo-600 hover:underline">
              Criar categorias
            </a>
          </p>
        )}
      </div>

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observações
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Informações adicionais..."
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {loading ? "Salvando..." : transactionId ? "Atualizar" : "Criar Transação"}
        </button>
      </div>
    </form>
  );
}
