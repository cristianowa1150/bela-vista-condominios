"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, Lock, ChevronDown } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // Local login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState("");

  // OAuth section toggle (collapsed by default when no keys configured)
  const [showOAuth, setShowOAuth] = useState(false);

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLocalLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("E-mail ou senha incorretos.");
      setLocalLoading(false);
      return;
    }

    if (result?.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Ocorreu um erro. Tente novamente.");
      setLocalLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900">
      <div className="w-full max-w-md px-6">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-5 backdrop-blur-sm border border-white/20">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Condomínio Bela Vista
          </h1>
          <p className="text-indigo-200 text-sm">Ibiá - MG · Sistema Financeiro</p>
        </div>

        {/* Card principal */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-7 shadow-2xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-0.5 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-300" />
              Entrar com e-mail e senha
            </h2>
            <p className="text-indigo-300 text-xs">Conta local do administrador</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleLocalLogin} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                autoComplete="email"
                required
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={localLoading}
              className="w-full py-3 bg-white text-indigo-900 font-semibold rounded-xl text-sm hover:bg-indigo-50 transition-colors disabled:opacity-60"
            >
              {localLoading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-transparent px-3 text-xs text-indigo-400">ou</span>
            </div>
          </div>

          {/* OAuth — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setShowOAuth((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/15 text-indigo-200 text-sm hover:bg-white/5 transition-colors"
            >
              <span>Entrar com conta Google / GitHub / Microsoft</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showOAuth ? "rotate-180" : ""}`}
              />
            </button>

            {showOAuth && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>

                <button
                  onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </button>

                <button
                  onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/dashboard" })}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current">
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                  </svg>
                  Microsoft
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-center text-xs text-indigo-400">
              Primeiro acesso?{" "}
              <a href="/setup" className="text-indigo-200 hover:text-white underline">
                Criar conta de administrador
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-indigo-500 text-xs mt-6">
          © {new Date().getFullYear()} Condomínio Bela Vista · Ibiá, MG
        </p>
      </div>
    </div>
  );
}
