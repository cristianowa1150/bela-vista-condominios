"use client";

import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, User, Shield, Menu, Camera, Trash2, X } from "lucide-react";
import ThemeSelector from "./theme-selector";
import PalettePicker from "./palette-picker";
import FaviconPicker from "./favicon-picker";
import { SidebarPalette } from "./sidebar-palettes";
import { compressImage } from "@/lib/compress-image";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
  onMobileMenuToggle: () => void;
  onAvatarChange: (url: string | null) => void;
  onPaletteChange: (p: SidebarPalette) => void;
}

export default function Header({ user, onMobileMenuToggle, onAvatarChange, onPaletteChange }: HeaderProps) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file, 256, 0.85);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressed }),
      });
      if (res.ok) {
        const data = await res.json();
        onAvatarChange(data.image);
        setAvatarMenuOpen(false);
      } else {
        const data = await res.json();
        setError(data.error ?? "Erro ao salvar imagem");
      }
    } catch {
      setError("Erro ao processar imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      if (res.ok) {
        onAvatarChange(null);
        setAvatarMenuOpen(false);
      } else {
        const data = await res.json();
        setError(data.error ?? "Erro ao remover imagem");
      }
    } catch {
      setError("Erro ao remover imagem");
    } finally {
      setUploading(false);
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-gray-800 font-semibold text-sm leading-tight">
            Sistema de Gestão Financeira
          </h1>
          <p className="text-gray-500 text-xs hidden sm:block">Condomínio Bela Vista · Ibiá, MG</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Favicon é identidade do sistema — somente administrador altera */}
        {user.role === "ADMIN" && <FaviconPicker />}
        <PalettePicker collapsed={false} onPaletteChange={onPaletteChange} _headerMode />
        <ThemeSelector />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <div className="relative flex items-center gap-2">
          <div className="hidden sm:block text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <p className="text-sm font-medium text-gray-700 leading-tight">{user.name ?? "Usuário"}</p>
              {user.role === "ADMIN" && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium"
                  /* Use CSS vars — same value server & client, no hydration mismatch */
                  style={{ backgroundColor: "var(--sb-accent-light)", color: "var(--sb-accent-text)" }}
                >
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          {/* Avatar button */}
          <button
            onClick={() => { setAvatarMenuOpen((v) => !v); setError(""); }}
            title="Alterar foto de perfil"
            className="relative group w-9 h-9 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--sb-accent-light)" }}
          >
            {user.image ? (
              <img src={user.image} alt={user.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: "var(--sb-accent-light)" }}
              >
                <User className="w-4 h-4" style={{ color: "var(--sb-accent)" }} />
              </div>
            )}
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-3.5 h-3.5 text-white" />
            </span>
          </button>

          {/* Avatar dropdown */}
          {avatarMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAvatarMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Foto de perfil</p>
                  <button onClick={() => setAvatarMenuOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview */}
                <div className="flex justify-center mb-4">
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden border-4 flex items-center justify-center"
                    style={{ borderColor: "var(--sb-accent-light)" }}
                  >
                    {user.image ? (
                      <img src={user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: "var(--sb-accent-light)" }}
                      >
                        <User className="w-8 h-8" style={{ color: "var(--sb-accent)" }} />
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 mb-2"
                  style={{ backgroundColor: "var(--sb-accent)" }}
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {uploading ? "Enviando…" : "Escolher foto"}
                </button>

                {user.image && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover foto
                  </button>
                )}

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
