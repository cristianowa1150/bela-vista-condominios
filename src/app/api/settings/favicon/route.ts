import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, ROLES_ADMIN } from "@/lib/authz";

/**
 * Favicon global do sistema — definido pelo administrador, exibido para todos.
 * GET é público (a aba do navegador precisa do ícone até na tela de login).
 */

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "favicon" } });
    return Response.json({ favicon: setting?.value ?? null });
  } catch {
    return Response.json({ favicon: null });
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await authorize(ROLES_ADMIN);
  if (error) return error;

  const body = await request.json() as { favicon?: string | null };

  if (body.favicon === null || body.favicon === "") {
    await prisma.appSetting.deleteMany({ where: { key: "favicon" } });
    return Response.json({ favicon: null });
  }

  if (typeof body.favicon !== "string" || !body.favicon.startsWith("data:image/")) {
    return Response.json({ error: "Formato de imagem inválido" }, { status: 400 });
  }
  if (body.favicon.length > 200_000) {
    return Response.json({ error: "Imagem muito grande" }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { key: "favicon" },
    create: { key: "favicon", value: body.favicon },
    update: { value: body.favicon },
  });

  return Response.json({ favicon: body.favicon });
}
