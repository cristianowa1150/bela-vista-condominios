"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Coffee } from "lucide-react";

type Theme = "light" | "dark" | "sepia";

const THEMES: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark",  label: "Escuro", icon: Moon },
  { value: "sepia", label: "Sépia", icon: Coffee },
];

export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("light");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      if (saved) setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch {}
    setOpen(false);
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];
  const Icon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Alterar tema"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors text-sm"
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline text-xs font-medium">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 border rounded-xl shadow-lg py-1 min-w-[130px] z-50"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          {THEMES.map(({ value, label, icon: ItemIcon }) => (
            <button
              key={value}
              onClick={() => applyTheme(value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                theme === value
                  ? "text-indigo-700 bg-indigo-50 font-medium"
                  : "hover:bg-gray-50"
              }`}
              style={{ color: theme === value ? undefined : "var(--text-2)" }}
            >
              <ItemIcon className="w-4 h-4 shrink-0" />
              {label}
              {theme === value && <span className="ml-auto text-indigo-600 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
