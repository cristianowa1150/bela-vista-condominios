import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["RECEITA", "DESPESA"]),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return Response.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const validated = categorySchema.safeParse(body);

  if (!validated.success) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      name: validated.data.name,
      type: validated.data.type,
      color: validated.data.color ?? "#6366f1",
      icon: validated.data.icon ?? "tag",
    },
  });

  return Response.json(category, { status: 201 });
}
