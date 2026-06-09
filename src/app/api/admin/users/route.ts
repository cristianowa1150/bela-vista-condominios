import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      accounts: { select: { provider: true } },
      _count: { select: { transactions: true, imports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      createdAt: u.createdAt,
      providers: u.accounts.map((a) => a.provider),
      transactionCount: u._count.transactions,
    }))
  );
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await request.json() as {
    userId: string;
    name?: string;
    email?: string;
    password?: string;
  };

  const { userId, name, email, password } = body;

  if (!userId) {
    return Response.json({ error: "userId é obrigatório" }, { status: 400 });
  }

  // Check target exists
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // E-mail uniqueness check
  if (email && email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "Este e-mail já está em uso" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim() || null;
  if (email !== undefined && email.trim()) updateData.email = email.trim().toLowerCase();
  if (password && password.trim().length >= 6) {
    updateData.password = await bcrypt.hash(password.trim(), 12);
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, email: true, role: true },
  });

  return Response.json(updated);
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await request.json() as {
    name: string;
    email: string;
    password: string;
    role?: string;
  };

  const { name, email, password, role } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  }
  if (password.trim().length < 6) {
    return Response.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return Response.json({ error: "Este e-mail já está em uso" }, { status: 400 });
  }

  const VALID_ROLES = ["ADMIN", "USER", "OPERATOR", "READ_ONLY", "PENDING", "REJECTED"];
  const assignedRole = role && VALID_ROLES.includes(role) ? role : "USER";

  const hashed = await bcrypt.hash(password.trim(), 12);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: assignedRole,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return Response.json(user, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId é obrigatório" }, { status: 400 });
  }
  if (userId === session.user.id) {
    return Response.json({ error: "Não é possível excluir sua própria conta" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return Response.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await request.json() as {
    userId: string;
    action: string;
    role?: string;
  };

  const { userId, action, role: rolePayload } = body;

  if (!userId || !action) {
    return Response.json({ error: "userId e action são obrigatórios" }, { status: 400 });
  }

  // Cannot modify yourself
  if (userId === session.user.id) {
    return Response.json({ error: "Não é possível modificar sua própria conta" }, { status: 400 });
  }

  const VALID_ROLES = ["ADMIN", "USER", "OPERATOR", "READ_ONLY", "REJECTED", "PENDING"];

  let newRole: string;
  if (action === "setRole") {
    if (!rolePayload || !VALID_ROLES.includes(rolePayload)) {
      return Response.json({ error: "Perfil inválido" }, { status: 400 });
    }
    newRole = rolePayload;
  } else {
    const roleMap: Record<string, string> = {
      approve: "USER",
      reject: "REJECTED",
      promote: "ADMIN",
      demote: "USER",
    };
    if (!roleMap[action]) {
      return Response.json({ error: "Ação inválida" }, { status: 400 });
    }
    newRole = roleMap[action];
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true },
  });

  return Response.json(updated);
}
