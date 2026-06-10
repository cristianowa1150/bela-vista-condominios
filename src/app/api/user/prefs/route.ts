import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Preferências visuais individuais do usuário logado.
 * JSON em User.preferences: { theme, palette, sidebarLogo }
 */

const VALID_THEMES = ["light", "dark", "sepia", "apple"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  let prefs: Record<string, unknown> = {};
  try {
    if (user?.preferences) prefs = JSON.parse(user.preferences);
  } catch {}

  return Response.json(prefs);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json() as {
    theme?: string;
    palette?: string;
    sidebarLogo?: string | null;
  };

  // Validações
  if (body.theme !== undefined && !VALID_THEMES.includes(body.theme)) {
    return Response.json({ error: "Tema inválido" }, { status: 400 });
  }
  if (body.palette !== undefined && typeof body.palette !== "string") {
    return Response.json({ error: "Paleta inválida" }, { status: 400 });
  }
  if (body.sidebarLogo !== undefined && body.sidebarLogo !== null) {
    if (typeof body.sidebarLogo !== "string" || !body.sidebarLogo.startsWith("data:image/")) {
      return Response.json({ error: "Imagem do menu inválida" }, { status: 400 });
    }
    if (body.sidebarLogo.length > 500_000) {
      return Response.json({ error: "Imagem do menu muito grande" }, { status: 400 });
    }
  }

  // Merge com as preferências existentes
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });
  let prefs: Record<string, unknown> = {};
  try {
    if (user?.preferences) prefs = JSON.parse(user.preferences);
  } catch {}

  if (body.theme !== undefined) prefs.theme = body.theme;
  if (body.palette !== undefined) prefs.palette = body.palette;
  if (body.sidebarLogo !== undefined) {
    if (body.sidebarLogo === null) delete prefs.sidebarLogo;
    else prefs.sidebarLogo = body.sidebarLogo;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: JSON.stringify(prefs) },
  });

  return Response.json(prefs);
}
