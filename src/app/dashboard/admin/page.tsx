"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import {
  Users,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  User,
  AlertCircle,
  Pencil,
  Eye,
  EyeOff,
  UserCog,
  UserPlus,
  Trash2,
} from "lucide-react";

interface UserEntry {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  providers: string[];
  transactionCount: number;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  ADMIN: { label: "Administrador", bg: "bg-indigo-100", text: "text-indigo-700", icon: Shield },
  USER: { label: "Operador Completo", bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  OPERATOR: { label: "Operador", bg: "bg-blue-100", text: "text-blue-700", icon: UserCog },
  READ_ONLY: { label: "Somente Leitura", bg: "bg-gray-100", text: "text-gray-700", icon: User },
  PENDING: { label: "Pendente", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  REJECTED: { label: "Rejeitado", bg: "bg-red-100", text: "text-red-700", icon: XCircle },
};

const ASSIGNABLE_ROLES = [
  { value: "ADMIN",     label: "Administrador" },
  { value: "USER",      label: "Operador Completo" },
  { value: "OPERATOR",  label: "Operador" },
  { value: "READ_ONLY", label: "Somente Leitura" },
  { value: "PENDING",   label: "Pendente" },
  { value: "REJECTED",  label: "Rejeitado" },
];

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

interface EditForm {
  userId: string;
  name: string;
  email: string;
  password: string;
  hasPassword: boolean;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_CREATE: CreateForm = { name: "", email: "", password: "", role: "USER" };

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers]     = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState<string | null>(null);
  const [filter, setFilter]   = useState<string>("ALL");
  const [error, setError]     = useState("");

  // Edit modal
  const [editForm, setEditForm]       = useState<EditForm | null>(null);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [showEditPw, setShowEditPw]   = useState(false);

  // Create modal
  const [createOpen, setCreateOpen]     = useState(false);
  const [createForm, setCreateForm]     = useState<CreateForm>(EMPTY_CREATE);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError]   = useState("");
  const [showCreatePw, setShowCreatePw] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget]   = useState<UserEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      router.push("/dashboard");
      return;
    }
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleRoleChange(userId: string, role: string) {
    setActing(userId);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "setRole", role }),
    });
    if (res.ok) {
      await fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error ?? "Erro ao alterar perfil");
    }
    setActing(null);
  }

  function openEdit(user: UserEntry) {
    setEditForm({
      userId: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      password: "",
      hasPassword: !user.providers.length || user.providers.includes("credentials"),
    });
    setEditError("");
    setEditSuccess("");
    setShowEditPw(false);
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setCreateError("");
    setShowCreatePw(false);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreateSaving(true);
    setCreateError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) { await fetchUsers(); setCreateOpen(false); }
    else { const d = await res.json(); setCreateError(d.error ?? "Erro ao criar usuário"); }
    setCreateSaving(false);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/admin/users?userId=${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) { await fetchUsers(); setDeleteTarget(null); }
    else { const d = await res.json(); setError(d.error ?? "Erro ao excluir"); setDeleteTarget(null); }
    setDeleteLoading(false);
  }

  async function handleEditSave() {
    if (!editForm) return;
    setEditSaving(true);
    setEditError("");
    setEditSuccess("");

    const body: Record<string, string> = { userId: editForm.userId };
    if (editForm.name.trim()) body.name = editForm.name.trim();
    if (editForm.email.trim()) body.email = editForm.email.trim();
    if (editForm.password.trim()) body.password = editForm.password.trim();

    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setEditSuccess("Dados atualizados com sucesso!");
      await fetchUsers();
      setTimeout(() => setEditForm(null), 1200);
    } else {
      const data = await res.json();
      setEditError(data.error ?? "Erro ao salvar");
    }
    setEditSaving(false);
  }

  const counts = {
    ALL: users.length,
    PENDING: users.filter((u) => u.role === "PENDING").length,
    USER: users.filter((u) => u.role === "USER").length,
    ADMIN: users.filter((u) => u.role === "ADMIN").length,
    REJECTED: users.filter((u) => u.role === "REJECTED").length,
  };

  const filtered =
    filter === "ALL" ? users : users.filter((u) => u.role === filter);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Painel de Administração
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as contas de acesso ao sistema</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "PENDING", label: "Pendentes", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
          { key: "USER", label: "Op. Completo", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
          { key: "ADMIN", label: "Administradores", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
          { key: "REJECTED", label: "Rejeitados", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
        ].map(({ key, label, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "ALL" : key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              filter === key ? `${bg} ${border}` : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <p className={`text-2xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Usuários {filter !== "ALL" && `— ${ROLE_CONFIG[filter]?.label}`}
            <span className="ml-2 text-gray-400 font-normal text-sm">({filtered.length})</span>
          </h2>
          {filter !== "ALL" && (
            <button
              onClick={() => setFilter("ALL")}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Ver todos
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <Users className="w-8 h-8" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((user) => {
              const roleCfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.PENDING;
              const RoleIcon = roleCfg.icon;
              const isActing = acting === user.id;
              const isPending = user.role === "PENDING";

              return (
                <div key={user.id} className="flex items-center gap-3 px-5 py-4 flex-wrap sm:flex-nowrap">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {user.image ? (
                      <img src={user.image} alt={user.name ?? ""} className="w-10 h-10 rounded-full border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{user.name ?? "Sem nome"}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleCfg.bg} ${roleCfg.text}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">Entrou: {formatDate(user.createdAt)}</span>
                      {user.providers.length > 0 && (
                        <span className="text-xs text-gray-400">
                          via {user.providers.map((p) => PROVIDER_LABELS[p] ?? p).join(", ")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{user.transactionCount} transações</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleRoleChange(user.id, "USER")}
                          disabled={isActing}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, "REJECTED")}
                          disabled={isActing}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Rejeitar
                        </button>
                      </>
                    )}

                    <select
                      value={user.role}
                      disabled={isActing}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    {isActing && (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    )}

                    <button
                      onClick={() => openEdit(user)}
                      title="Editar nome, e-mail ou senha"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(user)}
                      title="Excluir usuário"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create user modal ────────────────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              Novo Usuário Local
            </h3>
            <p className="text-gray-500 text-xs mb-5">Cria uma conta com login por e-mail e senha.</p>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@exemplo.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showCreatePw ? "text" : "password"}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCreatePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createForm.password && createForm.password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Mínimo 6 caracteres</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de acesso</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCreateOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createSaving || !createForm.name.trim() || !createForm.email.trim() || createForm.password.length < 6}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {createSaving ? "Criando…" : "Criar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit user modal ──────────────────────────────────────────────────── */}
      {editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1">Editar Usuário</h3>
            <p className="text-gray-500 text-xs mb-5">
              Deixe o campo de senha em branco para não alterá-la.
            </p>

            {editError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {editSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => f && { ...f, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => f && { ...f, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova senha
                  {!editForm.hasPassword && (
                    <span className="ml-2 text-xs font-normal text-amber-600">
                      (usuário OAuth — definir senha permite login por credenciais)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showEditPw ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => f && { ...f, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {editForm.password && editForm.password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Mínimo 6 caracteres</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditForm(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || (!!editForm.password && editForm.password.length < 6)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {editSaving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Excluir Usuário</h3>
                <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 text-sm text-gray-700">
              <p className="font-medium">{deleteTarget.name ?? "Sem nome"}</p>
              <p className="text-gray-500">{deleteTarget.email}</p>
              {deleteTarget.transactionCount > 0 && (
                <p className="text-amber-600 text-xs mt-1">
                  ⚠ Este usuário possui {deleteTarget.transactionCount} transações que também serão excluídas.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role legend */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-800 mb-3 text-sm">
          Perfis de acesso disponíveis
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-indigo-700">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
            <p><strong>Administrador:</strong> acesso total, aprova contas e gerencia usuários.</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
            <p><strong>Operador Completo:</strong> todas as funções financeiras, exceto administração.</p>
          </div>
          <div className="flex items-start gap-2">
            <UserCog className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <p><strong>Operador:</strong> importar extratos e emitir prestação de contas. Sem edição manual.</p>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
            <p><strong>Somente Leitura:</strong> visualiza dashboard, transações e relatórios. Sem alterações.</p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <p><strong>Pendente:</strong> aguardando aprovação. Sem acesso ao sistema.</p>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <p><strong>Rejeitado:</strong> acesso negado. Selecione outro perfil para reativar.</p>
          </div>
        </div>
        <p className="text-xs text-indigo-500 mt-3 pt-3 border-t border-indigo-200">
          O primeiro usuário a se cadastrar no sistema é automaticamente promovido a Administrador.
        </p>
      </div>
    </div>
  );
}
