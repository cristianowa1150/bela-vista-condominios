import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardShell from "@/components/layout/dashboard-shell";

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

  // Fetch image directly from DB — never stored in JWT to keep cookies small.
  let image: string | null = session.user.image ?? null;
  if (session.user.id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      });
      image = dbUser?.image ?? null;
    } catch {
      // fallback to session image (e.g. OAuth URL)
    }
  }

  return (
    <DashboardShell
      role={role}
      user={{ ...session.user, image }}
    >
      {children}
    </DashboardShell>
  );
}
