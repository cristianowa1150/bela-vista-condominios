"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserPlus, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => {
        if (!r.ok && r.status !== 500) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!text) throw new Error("Resposta vazia do servidor");
        const d = JSON.parse(text);
        setAvailable(d.available ?? false);
        if (d.error) setError(`Erro do servidor: ${d.error}`);
      })
      .catch((err) => {
        console.error("Erro ao verificar setup:", err);
        // Allow the form to render even if check fails
        setAvailable(true);
        setError("Não foi possível verificar o estado do servidor. Tente criar a conta normalmente.");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    let res: Response;
    let data: Record<string, unknown>;

    try {
      res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (fetchErr) {
      setError(`Erro de conexão: ${String(fetchErr)}`);
      setLoading(false);
      return;
    }

    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      const errMsg = typeof data.error === "string" ? data.error : "Erro ao criar administrador.";
      setError(errMsg);
      setLoading(false);
    }
  }

  // ── Loading state
  if (available === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // ── Already configured
  if (available === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Configuração já realizada</h1>
          <p className="text-gray-500 text-sm mb-6">
            O administrador já foi criado. Para acessar o sistema, faça login.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  // ── Success screen
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="bg-white rounded-2xl border border-green-200 shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Administrador criado!</h1>
          <p className="text-gray-500 text-sm">Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  // ── Setup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900">
      <div className="w-full max-w-md px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-5 backdrop-blur-sm border border-white/20">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Configuração Inicial</h1>
          <p className="text-indigo-200 text-sm">Condomínio Bela Vista · Ibiá, MG</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-7 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-5 h-5 text-indigo-200" />
            <h2 className="text-lg font-semibold text-white">Criar Administrador</h2>
          </div>
          <p className="text-indigo-200 text-xs mb-6">
            Esta conta terá acesso total ao sistema e poderá aprovar outros usuários.
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-indigo-100 mb-1">
                Nome completo *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: João da Silva"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-100 mb-1">
                E-mail *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@bellavista.com"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-100 mb-1">
                Senha *
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent pr-11"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-100 mb-1">
                Confirmar senha *
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Repita a senha"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-indigo-900 font-semibold rounded-xl text-sm hover:bg-indigo-50 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "Criando conta…" : "Criar Administrador"}
            </button>
          </form>

          <p className="text-indigo-400 text-xs text-center mt-4">
            Esta página só está disponível na primeira execução do sistema.
          </p>
        </div>

        <p className="text-center text-indigo-500 text-xs mt-6">
          © {new Date().getFullYear()} Condomínio Bela Vista · Ibiá, MG
        </p>
      </div>
    </div>
  );
}
