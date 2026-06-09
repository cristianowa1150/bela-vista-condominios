"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  Images,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

/* ─── tipos ─────────────────────────────────────────────── */
interface BingImage {
  full: string;
  thumb: string;
  title: string;
  copyright: string;
  date: string;
}

/* Gradientes de fallback (usados enquanto Bing carrega ou em erro) */
const FALLBACK_GRADIENTS = [
  {
    full: "",
    thumb: "",
    title: "Amanhecer Índigo",
    copyright: "",
    date: "",
    gradient: "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#1d4ed8 100%)",
  },
  {
    full: "",
    thumb: "",
    title: "Entardecer Teal",
    copyright: "",
    date: "",
    gradient: "linear-gradient(135deg,#042f2e 0%,#134e4a 40%,#0d9488 100%)",
  },
  {
    full: "",
    thumb: "",
    title: "Noite Violeta",
    copyright: "",
    date: "",
    gradient: "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#7c3aed 100%)",
  },
];

type BgOption = (BingImage | (typeof FALLBACK_GRADIENTS)[0]) & {
  gradient?: string;
};

/* ─── componente ─────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();

  /* form */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOAuth, setShowOAuth] = useState(false);

  /* backgrounds */
  const [bgList, setBgList] = useState<BgOption[]>(FALLBACK_GRADIENTS);
  const [bgIndex, setBgIndex] = useState(0);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* ── carrega imagens do Bing ── */
  useEffect(() => {
    const saved = localStorage.getItem("login-bg-index");
    fetch("/api/bing-bg")
      .then((r) => r.json())
      .then((imgs: BingImage[]) => {
        if (imgs.length > 0) {
          const merged: BgOption[] = [...imgs, ...FALLBACK_GRADIENTS];
          setBgList(merged);
          const idx = saved ? Math.min(Number(saved), merged.length - 1) : 0;
          setBgIndex(idx);
        } else {
          if (saved)
            setBgIndex(
              Math.min(Number(saved), FALLBACK_GRADIENTS.length - 1)
            );
        }
      })
      .catch(() => {
        if (saved)
          setBgIndex(Math.min(Number(saved), FALLBACK_GRADIENTS.length - 1));
      });
  }, []);

  /* fecha picker ao clicar fora */
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const current = bgList[bgIndex] ?? bgList[0];
  const hasFull = !!current?.full;

  function selectBg(idx: number) {
    setBgIndex(idx);
    setBgLoaded(false);
    localStorage.setItem("login-bg-index", String(idx));
    setShowPicker(false);
  }

  function prev() {
    const idx = (bgIndex - 1 + bgList.length) % bgList.length;
    selectBg(idx);
  }
  function next() {
    const idx = (bgIndex + 1) % bgList.length;
    selectBg(idx);
  }

  /* ── login ── */
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

  /* ─── render ─────────────────────────────────────── */
  return (
    <div className="relative min-h-screen overflow-hidden select-none">
      {/* ── Fundo ── */}
      {hasFull ? (
        <>
          {/* placeholder enquanto carrega */}
          <div
            className="absolute inset-0 bg-indigo-950 transition-opacity duration-700"
            style={{ opacity: bgLoaded ? 0 : 1 }}
          />
          {/* imagem real */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.full}
            src={current.full}
            alt={current.title}
            onLoad={() => setBgLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: bgLoaded ? 1 : 0 }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: (current as { gradient?: string }).gradient }}
        />
      )}

      {/* overlay escuro para legibilidade */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* ── Conteúdo ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5 border border-white/25"
            style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Building2 className="w-10 h-10 text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-1 tracking-tight">
            Condomínio Bela Vista
          </h1>
          <p className="text-white/70 text-sm tracking-wide">Ibiá · MG &nbsp;·&nbsp; Sistema Financeiro</p>
        </div>

        {/* Card glassmorphism */}
        <div
          className="w-full max-w-sm rounded-3xl p-7 space-y-5"
          style={{
            background: "rgba(255,255,255,0.13)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          {/* cabeçalho do card */}
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-white/60" />
              Entrar
            </h2>
            <p className="text-white/50 text-xs mt-0.5">Conta local do administrador</p>
          </div>

          {/* erro */}
          {error && (
            <div
              className="text-sm px-4 py-3 rounded-2xl text-red-100"
              style={{
                background: "rgba(239,68,68,0.25)",
                border: "1px solid rgba(239,68,68,0.35)",
                backdropFilter: "blur(8px)",
              }}
            >
              {error}
            </div>
          )}

          {/* formulário */}
          <form onSubmit={handleLocalLogin} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              autoComplete="email"
              required
              className="w-full px-4 py-3 rounded-2xl text-white placeholder-white/40 text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.17)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 rounded-2xl text-white placeholder-white/40 text-sm outline-none transition-all pr-12"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.17)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* botão entrar — estilo Apple solid */}
            <button
              type="submit"
              disabled={localLoading}
              className="w-full py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "#1e1b4b",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
              onMouseEnter={(e) => {
                if (!localLoading)
                  e.currentTarget.style.background = "rgba(255,255,255,1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.92)";
              }}
            >
              {localLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  Entrando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-white/35 text-xs">ou continue com</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          {/* OAuth collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setShowOAuth((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-white/60 text-sm transition-all"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.13)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
            >
              <span>Google · GitHub</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${showOAuth ? "rotate-180" : ""}`}
              />
            </button>

            {showOAuth && (
              <div className="mt-3 space-y-2">
                {/* Google */}
                <button
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                  style={{
                    background: "rgba(255,255,255,0.93)",
                    color: "#374151",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.93)"; }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>

                {/* GitHub */}
                <button
                  onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-white"
                  style={{
                    background: "rgba(17,24,39,0.85)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(17,24,39,1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(17,24,39,0.85)"; }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </button>

              </div>
            )}
          </div>

          <div className="pt-1 border-t border-white/10">
            <p className="text-center text-xs text-white/35">
              Primeiro acesso?{" "}
              <a href="/setup" className="text-white/60 hover:text-white underline transition-colors">
                Criar conta de administrador
              </a>
            </p>
          </div>
        </div>

        {/* rodapé */}
        <p className="text-white/30 text-xs mt-6 tracking-wide">
          © {new Date().getFullYear()} Condomínio Bela Vista · Ibiá, MG
        </p>
      </div>

      {/* ── Controles de fundo (canto inferior direito) ── */}
      <div className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2" ref={pickerRef}>

        {/* tooltip de crédito da foto */}
        {showInfo && current.copyright && (
          <div
            className="text-xs text-white/80 px-3 py-1.5 rounded-xl max-w-xs text-right leading-snug"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span className="font-medium text-white/60">Foto do dia · Bing</span><br />
            {current.copyright}
          </div>
        )}

        {/* picker de thumbnails */}
        {showPicker && (
          <div
            className="rounded-2xl p-3 flex gap-2 flex-wrap justify-end max-w-sm"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            }}
          >
            {bgList.map((bg, i) => (
              <button
                key={i}
                onClick={() => selectBg(i)}
                title={bg.title}
                className="relative w-16 h-10 rounded-xl overflow-hidden flex-shrink-0 transition-all"
                style={{
                  outline: i === bgIndex ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent",
                  outlineOffset: "2px",
                  opacity: i === bgIndex ? 1 : 0.65,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = i === bgIndex ? "1" : "0.65";
                }}
              >
                {bg.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bg.thumb} alt={bg.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: (bg as {gradient?: string}).gradient }} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* barra de controles */}
        <div
          className="flex items-center gap-1 rounded-2xl px-2 py-1.5"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {/* anterior */}
          <button
            onClick={prev}
            title="Fundo anterior"
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* abrir picker */}
          <button
            onClick={() => setShowPicker((s) => !s)}
            title="Escolher fundo"
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
            style={{ color: showPicker ? "rgba(255,255,255,0.95)" : "" }}
          >
            <Images className="w-4 h-4" />
          </button>

          {/* info / crédito */}
          {hasFull && (
            <button
              onClick={() => setShowInfo((s) => !s)}
              title="Crédito da foto"
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
              style={{ color: showInfo ? "rgba(255,255,255,0.95)" : "" }}
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {/* próximo */}
          <button
            onClick={next}
            title="Próximo fundo"
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* nome da foto atual */}
          <span className="text-white/35 text-xs px-1 max-w-[140px] truncate hidden sm:block">
            {current.title}
          </span>
        </div>
      </div>
    </div>
  );
}
