import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json() as { image?: string; name?: string };

  const updateData: Record<string, string | null> = {};

  if ("image" in body) {
    // Accept data URL (base64) or null to remove
    if (body.image === null || body.image === "") {
      updateData.image = null;
    } else if (typeof body.image === "string" && body.image.startsWith("data:image/")) {
      updateData.image = body.image;
    } else {
      return Response.json({ error: "Formato de imagem inválido" }, { status: 400 });
    }
  }

  if (body.name !== undefined) {
    updateData.name = body.name?.trim() || null;
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, image: true },
  });

  return Response.json(updated);
}
