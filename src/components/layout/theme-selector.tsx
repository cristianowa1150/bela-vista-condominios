"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Coffee } from "lucide-react";

type Theme = "light" | "dark" | "sepia" | "apple";

/* Apple logo SVG inline — sem dependência de ícone externo */
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.29.07 2.22.79 2.97.79.79 0 2.26-.97 3.8-.83 1.65.14 2.87.87 3.66 2.18-3.36 1.98-2.79 6.36.57 7.54-.35.91-.82 1.83-1.37 2.73zm-4.2-14.36c-.13 1.72 1.25 3.15 2.89 3.15.14-1.75-1.26-3.11-2.89-3.15z" />
    </svg>
  );
}

const THEMES: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Claro",  icon: Sun },
  { value: "dark",  label: "Escuro", icon: Moon },
  { value: "sepia", label: "Sépia",  icon: Coffee },
  { value: "apple", label: "Apple",  icon: AppleIcon },
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
        <div
          className="absolute right-0 top-full mt-1 border rounded-xl shadow-lg py-1 min-w-[140px] z-50"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
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
              {theme === value && (
                <span className="ml-auto text-indigo-600 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
