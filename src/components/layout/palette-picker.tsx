"use client";

import { useState, useEffect, useRef } from "react";
import { Palette } from "lucide-react";
import { SIDEBAR_PALETTES, SidebarPalette, loadPalette } from "./sidebar-palettes";

interface PalettePickerProps {
  collapsed: boolean;
  onPaletteChange: (p: SidebarPalette) => void;
  /** When true, renders as a header button (light bg, no sidebar CSS vars) */
  _headerMode?: boolean;
}

export default function PalettePicker({ collapsed, onPaletteChange, _headerMode }: PalettePickerProps) {
  const [current, setCurrent] = useState<SidebarPalette>(loadPalette);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrent(loadPalette()); }, []);

  // Sync palette changes from sidebar instance to header instance (and vice-versa)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "sidebar-palette") setCurrent(loadPalette());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function apply(p: SidebarPalette) {
    setCurrent(p);
    onPaletteChange(p);
    // Also notify DashboardShell via storage event (cross-component sync)
    try { localStorage.setItem("sidebar-palette", p.id); } catch {}
    // Dispatch storage event for other components listening
    window.dispatchEvent(new StorageEvent("storage", { key: "sidebar-palette", newValue: p.id }));
    setOpen(false);
  }

  if (_headerMode) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Cores do menu"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors text-sm"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">Menu</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-3 px-3 z-50 w-56">
            <p className="text-xs font-semibold text-gray-700 mb-2.5">Cor do menu lateral</p>
            <div className="grid grid-cols-4 gap-2">
              {SIDEBAR_PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => apply(p)}
                  title={p.name}
                  className="relative group"
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ backgroundColor: p.bg, border: `2px solid ${current.id === p.id ? "#6366f1" : "transparent"}` }}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.accent }} />
                  </div>
                  {current.id === p.id && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: p.accent }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">{current.name}</p>
          </div>
        )}
      </div>
    );
  }

  // Sidebar mode (not used currently but kept for flexibility)
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Personalizar cores"
        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors"
        style={{ color: "var(--sb-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sb-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
      >
        <Palette className="w-4 h-4 shrink-0" />
        {!collapsed && <span>Personalizar</span>}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 rounded-xl shadow-2xl p-3 z-50 w-56"
          style={{ backgroundColor: "var(--sb-hover)", border: "1px solid var(--sb-border)" }}
        >
          <p className="text-xs font-semibold mb-2.5 px-1" style={{ color: "var(--sb-text-nav)" }}>Cor do menu</p>
          <div className="grid grid-cols-4 gap-2">
            {SIDEBAR_PALETTES.map((p) => (
              <button key={p.id} onClick={() => apply(p)} title={p.name} className="relative group">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: p.bg, border: `2px solid ${current.id === p.id ? "white" : "transparent"}` }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.accent }} />
                </div>
                {current.id === p.id && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: p.accent }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
