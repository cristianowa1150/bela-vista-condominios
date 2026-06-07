import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** DELETE — clear imported data (admin only) */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Apenas administradores podem limpar dados" }, { status: 403 });
  }

  const { scope } = await request.json() as { scope: "imported" | "all" };

  if (scope === "imported") {
    // Delete only imported transactions (keep manual entries)
    const [transactions, imports, statements] = await Promise.all([
      prisma.transaction.deleteMany({ where: { source: { not: "MANUAL" } } }),
      prisma.importHistory.deleteMany({}),
      prisma.accountStatement.deleteMany({}),
    ]);
    return Response.json({
      success: true,
      deleted: {
        transactions: transactions.count,
        imports: imports.count,
        statements: statements.count,
      },
    });
  }

  if (scope === "all") {
    // Delete everything (keep categories and users)
    const [transactions, imports, statements] = await Promise.all([
      prisma.transaction.deleteMany({}),
      prisma.importHistory.deleteMany({}),
      prisma.accountStatement.deleteMany({}),
    ]);
    return Response.json({
      success: true,
      deleted: {
        transactions: transactions.count,
        imports: imports.count,
        statements: statements.count,
      },
    });
  }

  return Response.json({ error: "scope inválido" }, { status: 400 });
}
