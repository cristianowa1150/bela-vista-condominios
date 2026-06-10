"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import {
  SidebarPalette,
  DEFAULT_PALETTE,
  SIDEBAR_PALETTES,
  loadPalette,
  paletteToVars,
} from "./sidebar-palettes";

interface UserPrefs {
  theme?: string;
  palette?: string;
  sidebarLogo?: string;
}

interface DashboardShellProps {
  role: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
  initialPrefs?: UserPrefs;
  favicon?: string | null;
  children: React.ReactNode;
}

/** Persiste preferências do usuário no servidor (fire-and-forget) */
function savePrefs(partial: Record<string, unknown>) {
  try {
    fetch("/api/user/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => {});
  } catch {}
}

/** Apply palette CSS vars to :root so they are available globally */
function applyPaletteToRoot(p: SidebarPalette) {
  const vars = paletteToVars(p);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

const CRYSTAL_PALETTE = SIDEBAR_PALETTES.find((p) => p.id === "crystal") ?? DEFAULT_PALETTE;

export default function DashboardShell({ role, user, initialPrefs, favicon, children }: DashboardShellProps) {
  // Always start with deterministic defaults — localStorage is read in useEffect
  // to avoid server/client hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [palette, setPalette] = useState<SidebarPalette>(DEFAULT_PALETTE);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.image ?? null);
  const [sidebarLogo, setSidebarLogo] = useState<string | null>(null);

  // After hydration: aplica as preferências DO USUÁRIO (vindas do banco).
  // localStorage é só cache do primeiro paint; o banco é a fonte da verdade.
  useEffect(() => {
    // collapsed (preferência de dispositivo, fica local)
    if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);

    // Tema do usuário — sem preferência salva, volta ao padrão (o cache do
    // navegador pode conter o tema do usuário ANTERIOR nesta máquina)
    const theme = initialPrefs?.theme ?? "light";
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}

    // Paleta do usuário — idem: sem preferência, aplica a padrão
    const found = initialPrefs?.palette
      ? SIDEBAR_PALETTES.find((p) => p.id === initialPrefs.palette)
      : undefined;
    const paletteToApply = found ?? DEFAULT_PALETTE;
    setPalette(paletteToApply);
    applyPaletteToRoot(paletteToApply);
    try { localStorage.setItem("sidebar-palette", paletteToApply.id); } catch {}

    // Logo do menu lateral do usuário
    if (initialPrefs?.sidebarLogo) {
      setSidebarLogo(initialPrefs.sidebarLogo);
      try { localStorage.setItem("sidebar-logo", initialPrefs.sidebarLogo); } catch {}
    } else {
      try { localStorage.removeItem("sidebar-logo"); } catch {}
    }

    // Favicon global (definido pelo administrador)
    try {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      if (favicon) {
        link.href = favicon;
        localStorage.setItem("app-favicon", favicon);
      } else {
        link.href = "/favicon.ico";
        localStorage.removeItem("app-favicon");
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  function handlePaletteChange(p: SidebarPalette) {
    setPalette(p);
    applyPaletteToRoot(p);
    try { localStorage.setItem("sidebar-palette", p.id); } catch {}
    savePrefs({ palette: p.id });
  }

  /**
   * When the user switches to Apple theme, auto-apply the Crystal palette
   * (light sidebar) so the glass effect looks right.
   * When switching away from Apple, restore the previous non-crystal palette.
   */
  useEffect(() => {
    function onThemeChange() {
      const theme = document.documentElement.getAttribute("data-theme");
      // Persiste o tema escolhido pelo usuário
      if (theme) savePrefs({ theme });
      if (theme === "apple") {
        // Switch to Crystal palette for the light glass sidebar
        const prev = loadPalette();
        if (prev.id !== "crystal") {
          try { localStorage.setItem("sidebar-palette-before-apple", prev.id); } catch {}
        }
        handlePaletteChange(CRYSTAL_PALETTE);
        setPalette(CRYSTAL_PALETTE);
      } else {
        // Restore palette from before Apple was applied
        try {
          const beforeId = localStorage.getItem("sidebar-palette-before-apple");
          if (beforeId) {
            const found = SIDEBAR_PALETTES.find((p) => p.id === beforeId);
            if (found) {
              handlePaletteChange(found);
              setPalette(found);
            }
          }
        } catch {}
      }
    }

    // Watch for data-theme attribute mutations
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") onThemeChange();
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSidebarLogoChange(dataUrl: string | null) {
    setSidebarLogo(dataUrl);
    try {
      if (dataUrl) localStorage.setItem("sidebar-logo", dataUrl);
      else localStorage.removeItem("sidebar-logo");
    } catch {}
    savePrefs({ sidebarLogo: dataUrl });
  }

  return (
    // No palette style here — CSS vars live on :root (applied by inline script + applyPaletteToRoot)
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onPaletteChange={handlePaletteChange}
        sidebarLogo={sidebarLogo}
        onSidebarLogoChange={handleSidebarLogoChange}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          user={{ ...user, image: avatarUrl }}
          onMobileMenuToggle={() => setMobileOpen((v) => !v)}
          onAvatarChange={setAvatarUrl}
          onPaletteChange={handlePaletteChange}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
