import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const setupSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

/** GET — check if setup is still possible (no users exist) */
export async function GET() {
  try {
    const count = await prisma.user.count();
    return Response.json({ available: count === 0 });
  } catch (err) {
    console.error("[/api/setup GET] Prisma error:", err);
    return Response.json(
      { available: false, error: "Erro ao verificar banco de dados." },
      { status: 500 }
    );
  }
}

/** POST — create the first admin account */
export async function POST(request: NextRequest) {
  try {
    const count = await prisma.user.count();
    if (count > 0) {
      return Response.json(
        { error: "Configuração inicial já foi concluída." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = setupSchema.safeParse(body);

    if (!validated.success) {
      return Response.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = validated.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "E-mail já cadastrado." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });

    return Response.json(
      { success: true, userId: admin.id, name: admin.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("[/api/setup POST] Error:", err);
    return Response.json(
      { error: "Erro interno. Veja o console do servidor." },
      { status: 500 }
    );
  }
}
