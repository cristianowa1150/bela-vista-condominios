export interface SidebarPalette {
  id: string;
  name: string;
  bg: string;
  active: string;
  hover: string;
  border: string;
  textNav: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentText: string;
}

export const SIDEBAR_PALETTES: SidebarPalette[] = [
  {
    id: "indigo",
    name: "Índigo",
    bg: "#1e1b4b",
    active: "#4338ca",
    hover: "#312e81",
    border: "#312e81",
    textNav: "#a5b4fc",
    textMuted: "#818cf8",
    accent: "#4f46e5",
    accentLight: "#e0e7ff",
    accentText: "#4338ca",
  },
  {
    id: "slate",
    name: "Ardósia",
    bg: "#0f172a",
    active: "#334155",
    hover: "#1e293b",
    border: "#1e293b",
    textNav: "#94a3b8",
    textMuted: "#64748b",
    accent: "#475569",
    accentLight: "#f1f5f9",
    accentText: "#334155",
  },
  {
    id: "blue",
    name: "Azul",
    bg: "#1e3a5f",
    active: "#1d4ed8",
    hover: "#1e40af",
    border: "#1e40af",
    textNav: "#93c5fd",
    textMuted: "#60a5fa",
    accent: "#2563eb",
    accentLight: "#dbeafe",
    accentText: "#1d4ed8",
  },
  {
    id: "green",
    name: "Verde",
    bg: "#052e16",
    active: "#15803d",
    hover: "#166534",
    border: "#166534",
    textNav: "#86efac",
    textMuted: "#4ade80",
    accent: "#16a34a",
    accentLight: "#dcfce7",
    accentText: "#15803d",
  },
  {
    id: "purple",
    name: "Roxo",
    bg: "#2e1065",
    active: "#7e22ce",
    hover: "#6b21a8",
    border: "#6b21a8",
    textNav: "#d8b4fe",
    textMuted: "#c084fc",
    accent: "#9333ea",
    accentLight: "#f3e8ff",
    accentText: "#7e22ce",
  },
  {
    id: "red",
    name: "Vermelho",
    bg: "#450a0a",
    active: "#b91c1c",
    hover: "#991b1b",
    border: "#991b1b",
    textNav: "#fca5a5",
    textMuted: "#f87171",
    accent: "#dc2626",
    accentLight: "#fee2e2",
    accentText: "#b91c1c",
  },
  {
    id: "amber",
    name: "Âmbar",
    bg: "#451a03",
    active: "#b45309",
    hover: "#92400e",
    border: "#92400e",
    textNav: "#fcd34d",
    textMuted: "#fbbf24",
    accent: "#d97706",
    accentLight: "#fef3c7",
    accentText: "#b45309",
  },
  {
    id: "teal",
    name: "Teal",
    bg: "#042f2e",
    active: "#0f766e",
    hover: "#115e59",
    border: "#115e59",
    textNav: "#5eead4",
    textMuted: "#2dd4bf",
    accent: "#0d9488",
    accentLight: "#ccfbf1",
    accentText: "#0f766e",
  },
  {
    id: "crystal",
    name: "Cristal",
    bg: "#dce8fb",          // cor opaca para o swatch — CSS do Apple tema sobrepõe com rgba
    active: "rgba(79,100,235,0.82)",
    hover: "rgba(79,100,235,0.10)",
    border: "rgba(170,195,255,0.50)",
    textNav: "#2d3d9a",
    textMuted: "#5c70c0",
    accent: "#4f64eb",
    accentLight: "rgba(79,100,235,0.12)",
    accentText: "#3348d0",
  },
];

export const DEFAULT_PALETTE = SIDEBAR_PALETTES[0];

export function paletteToVars(p: SidebarPalette): Record<string, string> {
  return {
    "--sb-bg":           p.bg,
    "--sb-active":       p.active,
    "--sb-hover":        p.hover,
    "--sb-border":       p.border,
    "--sb-text-nav":     p.textNav,
    "--sb-text-muted":   p.textMuted,
    "--sb-accent":       p.accent,
    "--sb-accent-light": p.accentLight,
    "--sb-accent-text":  p.accentText,
  };
}

export function loadPalette(): SidebarPalette {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const saved = localStorage.getItem("sidebar-palette");
    if (saved) {
      const found = SIDEBAR_PALETTES.find((p) => p.id === saved);
      if (found) return found;
    }
  } catch {}
  return DEFAULT_PALETTE;
}
