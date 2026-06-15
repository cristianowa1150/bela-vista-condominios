"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Upload, BarChart3,
  Tag, Building2, Shield, FileText, Menu, X, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { SidebarPalette } from "./sidebar-palettes";
import { compressImage } from "@/lib/compress-image";

type Role = "ADMIN" | "USER" | "OPERATOR" | "READ_ONLY" | "PENDING" | "REJECTED";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  USER: "Operador Completo",
  OPERATOR: "Operador",
  READ_ONLY: "Somente Leitura",
};

interface NavItem {
  href: string; label: string; icon: React.ElementType; roles: Role[];
}

const navItems: NavItem[] = [
  { href: "/dashboard",              label: "Dashboard",           icon: LayoutDashboard, roles: ["ADMIN","USER","OPERATOR","READ_ONLY"] },
  { href: "/dashboard/transactions", label: "Transações",          icon: ArrowUpDown,     roles: ["ADMIN","USER","OPERATOR","READ_ONLY"] },
  { href: "/dashboard/import",       label: "Importar",            icon: Upload,          roles: ["ADMIN","USER","OPERATOR"] },
  { href: "/dashboard/prestacao",    label: "Prestação de Contas", icon: FileText,        roles: ["ADMIN","USER","OPERATOR"] },
  { href: "/dashboard/reports",      label: "Relatórios",          icon: BarChart3,       roles: ["ADMIN","USER","OPERATOR","READ_ONLY"] },
  { href: "/dashboard/categories",   label: "Categorias",          icon: Tag,             roles: ["ADMIN","USER"] },
];

interface SidebarProps {
  role: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onPaletteChange: (p: SidebarPalette) => void;
  sidebarLogo: string | null;
  onSidebarLogoChange: (url: string | null) => void;
}

export default function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = props.role === "ADMIN";
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((users: Array<{ role: string }>) => {
        if (Array.isArray(users)) setPendingCount(users.filter((u) => u.role === "PENDING").length);
      })
      .catch(() => {});
  }, [isAdmin]);

  const visibleItems = navItems.filter((item) => item.roles.includes(props.role as Role));

  const sharedContent = {
    ...props,
    isAdmin,
    pathname,
    pendingCount,
    visibleItems,
  };

  return (
    <>
      <aside
        className={cn("hidden md:flex flex-col shrink-0 sidebar-transition overflow-hidden", props.collapsed ? "w-16" : "w-64")}
        style={{ backgroundColor: "var(--sb-bg)" }}
      >
        <SidebarContent {...sharedContent} onClose={undefined} />
      </aside>

      <aside
        className={cn("md:hidden fixed top-0 left-0 h-full w-64 flex flex-col z-30 sidebar-transition", props.mobileOpen ? "translate-x-0" : "-translate-x-full")}
        style={{ backgroundColor: "var(--sb-bg)" }}
      >
        <SidebarContent {...sharedContent} onClose={props.onMobileClose} />
      </aside>
    </>
  );
}

interface ContentProps extends SidebarProps {
  isAdmin: boolean;
  pathname: string;
  pendingCount: number;
  visibleItems: NavItem[];
  onClose: (() => void) | undefined;
}

function SidebarContent(props: ContentProps) {
  const {
    role, isAdmin, pathname, collapsed, onToggleCollapse, pendingCount,
    visibleItems, onClose, sidebarLogo, onSidebarLogoChange,
  } = props;

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoLoading, setLogoLoading] = useState(false);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoLoading(true);
    try {
      const compressed = await compressImage(file, 128, 0.9);
      onSidebarLogoChange(compressed);
    } finally {
      setLogoLoading(false);
      e.target.value = "";
    }
  }

  function navStyle(active: boolean): React.CSSProperties {
    return active
      ? { backgroundColor: "var(--sb-active)", color: "#fff" }
      : { color: "var(--sb-text-nav)" };
  }
  function navEnter(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.backgroundColor = "var(--sb-hover)";
  }
  function navLeave(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.backgroundColor = "";
  }

  return (
    <>
      {/* ── Header: hamburger + logo ──────────────────────────────────── */}
      <div
        className={cn("flex items-center h-14 shrink-0", collapsed ? "justify-center px-2" : "px-3 gap-2")}
        style={{ borderBottom: "1px solid var(--sb-border)" }}
      >
        <button
          onClick={onClose ?? onToggleCollapse}
          title={onClose ? "Fechar" : collapsed ? "Expandir" : "Recolher"}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0"
          style={{ color: "var(--sb-text-nav)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sb-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
        >
          {onClose ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Logo icon — click to upload, ×-button to reset */}
            <div className="relative shrink-0 group">
              <button
                onClick={() => logoInputRef.current?.click()}
                title="Clique para alterar o ícone do menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--sb-accent)" }}
              >
                {logoLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : sidebarLogo ? (
                  <img src={sidebarLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-4 h-4 text-white" />
                )}
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <Camera className="w-3 h-3 text-white" />
                </span>
              </button>
              {/* Reset button — only shown when custom logo is set */}
              {sidebarLogo && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSidebarLogoChange(null); }}
                  title="Restaurar ícone padrão"
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--sb-text-nav)" }}>Bela Vista</p>
              <p className="text-xs truncate" style={{ color: "var(--sb-text-muted)" }}>Ibiá - MG</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={onClose}
              className={cn("flex items-center rounded-lg text-sm font-medium transition-colors", collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5")}
              style={navStyle(active)}
              onMouseEnter={(e) => navEnter(e, active)}
              onMouseLeave={(e) => navLeave(e, active)}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-2" style={{ borderTop: "1px solid var(--sb-border)" }} />
            <Link
              href="/dashboard/admin"
              title={collapsed ? "Administração" : undefined}
              onClick={onClose}
              className={cn("flex items-center rounded-lg text-sm font-medium transition-colors relative", collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5")}
              style={navStyle(pathname.startsWith("/dashboard/admin"))}
              onMouseEnter={(e) => navEnter(e, pathname.startsWith("/dashboard/admin"))}
              onMouseLeave={(e) => navLeave(e, pathname.startsWith("/dashboard/admin"))}
            >
              <Shield className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">Administração</span>
                  {pendingCount > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && pendingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full" />
              )}
            </Link>
          </>
        )}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      {!collapsed && ROLE_LABELS[role] && (
        <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--sb-border)" }}>
          <p className="text-xs text-center font-medium truncate" style={{ color: "var(--sb-text-muted)" }}>
            {role === "ADMIN" && "👑 "}
            {ROLE_LABELS[role]}
          </p>
        </div>
      )}
    </>
  );
}
