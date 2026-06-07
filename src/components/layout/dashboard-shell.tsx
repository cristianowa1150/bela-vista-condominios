"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import {
  SidebarPalette,
  DEFAULT_PALETTE,
  loadPalette,
  paletteToVars,
} from "./sidebar-palettes";

interface DashboardShellProps {
  role: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
  children: React.ReactNode;
}

/** Apply palette CSS vars to :root so they are available globally */
function applyPaletteToRoot(p: SidebarPalette) {
  const vars = paletteToVars(p);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

export default function DashboardShell({ role, user, children }: DashboardShellProps) {
  // Always start with deterministic defaults — localStorage is read in useEffect
  // to avoid server/client hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [palette, setPalette] = useState<SidebarPalette>(DEFAULT_PALETTE);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.image ?? null);
  const [sidebarLogo, setSidebarLogo] = useState<string | null>(null);

  // After hydration: load persisted preferences
  useEffect(() => {
    // collapsed
    if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);

    // palette — CSS vars already applied by inline script in layout.tsx, just sync state
    const saved = loadPalette();
    if (saved.id !== DEFAULT_PALETTE.id) setPalette(saved);

    // sidebar logo
    const logo = localStorage.getItem("sidebar-logo");
    if (logo) setSidebarLogo(logo);
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
  }

  function handleSidebarLogoChange(dataUrl: string | null) {
    setSidebarLogo(dataUrl);
    try {
      if (dataUrl) localStorage.setItem("sidebar-logo", dataUrl);
      else localStorage.removeItem("sidebar-logo");
    } catch {}
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
