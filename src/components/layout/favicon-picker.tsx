"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Trash2, Upload, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

/** Aplica o favicon na aba do navegador e persiste no localStorage */
function applyFavicon(dataUrl: string | null) {
  try {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (dataUrl) {
      link.href = dataUrl;
      localStorage.setItem("app-favicon", dataUrl);
    } else {
      link.href = "/favicon.ico";
      localStorage.removeItem("app-favicon");
    }
  } catch {}
}

export default function FaviconPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Carrega favicon salvo */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("app-favicon");
      if (saved) setCurrent(saved);
    } catch {}
  }, []);

  /* Fecha ao clicar fora */
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      /* Comprime para 64 × 64 — tamanho ideal para favicon */
      const dataUrl = await compressImage(file, 64, 0.95);
      applyFavicon(dataUrl);
      setCurrent(dataUrl);
      setOpen(false);
    } catch {
      setError("Erro ao processar imagem.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleRemove() {
    applyFavicon(null);
    setCurrent(null);
    setOpen(false);
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Botão de trigger */}
      <button
        onClick={() => { setOpen((v) => !v); setError(""); }}
        title="Favicon da aba"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors text-sm"
      >
        {current ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current} alt="favicon" className="w-4 h-4 rounded-sm object-cover" />
        ) : (
          <Globe className="w-4 h-4" />
        )}
        <span className="hidden sm:inline text-xs font-medium">Ícone</span>
      </button>

      {/* Painel dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-60 rounded-2xl border shadow-xl z-50 p-4 space-y-3"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Favicon da aba
            </p>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: "var(--text-4)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}
            >
              {current ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={current} alt="favicon preview" className="w-8 h-8 object-contain rounded" />
              ) : (
                <Globe className="w-5 h-5" style={{ color: "var(--text-4)" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                {current ? "Ícone personalizado" : "Ícone padrão"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                Aparece na aba do navegador
              </p>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="space-y-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60"
              style={{ backgroundColor: "var(--sb-accent)" }}
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "Processando…" : "Escolher imagem"}
            </button>

            {current && (
              <button
                onClick={handleRemove}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Restaurar padrão
              </button>
            )}
          </div>

          <p className="text-[10px] text-center" style={{ color: "var(--text-4)" }}>
            Recomendado: imagem quadrada, mín. 64 × 64 px
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
