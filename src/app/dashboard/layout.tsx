import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardShell from "@/components/layout/dashboard-shell";

export interface UserPrefs {
  theme?: string;
  palette?: string;
  sidebarLogo?: string;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "PENDING") redirect("/pending");
  if (role === "REJECTED") redirect("/rejected");

  // Imagem e preferências vêm do banco — nunca do JWT (cookie pequeno).
  let image: string | null = session.user.image ?? null;
  let prefs: UserPrefs = {};
  let favicon: string | null = null;

  if (session.user.id) {
    try {
      const [dbUser, faviconSetting] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { image: true, preferences: true },
        }),
        prisma.appSetting.findUnique({ where: { key: "favicon" } }),
      ]);
      image = dbUser?.image ?? null;
      favicon = faviconSetting?.value ?? null;
      if (dbUser?.preferences) {
        try { prefs = JSON.parse(dbUser.preferences); } catch {}
      }
    } catch {
      // fallback to session image (e.g. OAuth URL)
    }
  }

  return (
    <DashboardShell
      role={role}
      user={{ ...session.user, image }}
      initialPrefs={prefs}
      favicon={favicon}
    >
      {children}
    </DashboardShell>
  );
}
