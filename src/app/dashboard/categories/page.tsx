"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
}


export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "DESPESA",
    color: "#6366f1",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchCategories() {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({ name: cat.name, type: cat.type, color: cat.color });
    setShowForm(true);
    setError("");
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", type: "DESPESA", color: "#6366f1" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      resetForm();
      fetchCategories();
    } else {
      const data = await res.json();
      setError(data.error ?? "Erro ao salvar");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setDeleteId(null);
    fetchCategories();
  }

  const receitas = categories.filter((c) => c.type === "RECEITA");
  const despesas = categories.filter((c) => c.type === "DESPESA");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-gray-500 text-sm mt-1">
            Organize suas receitas e despesas
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">
              {editingId ? "Editar Categoria" : "Nova Categoria"}
            </h3>
            {error && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 p-2 rounded-lg">{error}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tipo *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Cor</label>
                <ColorPicker
                  value={form.color}
                  onChange={(color) => setForm((f) => ({ ...f, color }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Confirmar exclusão</h3>
            <p className="text-gray-600 text-sm mb-6">
              As transações desta categoria perderão a associação.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategorySection
            title="Receitas"
            categories={receitas}
            onEdit={startEdit}
            onDelete={setDeleteId}
            emptyColor="text-green-600"
          />
          <CategorySection
            title="Despesas"
            categories={despesas}
            onEdit={startEdit}
            onDelete={setDeleteId}
            emptyColor="text-red-600"
          />
        </div>
      )}
    </div>
  );
}

function CategorySection({
  title,
  categories,
  onEdit,
  onDelete,
  emptyColor,
}: {
  title: string;
  categories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
  emptyColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className={`font-semibold text-lg mb-4 ${emptyColor}`}>{title}</h2>
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
          <Tag className="w-8 h-8" />
          <p className="text-sm">Nenhuma categoria de {title.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: cat.color + "20" }}
              >
                <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(cat)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(cat.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
