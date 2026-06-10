import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TransactionForm from "@/components/transactions/transaction-form";

export default async function EditTransactionPage(
  props: PageProps<"/dashboard/transactions/[id]/edit">
) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await props.params;

  // Livro-caixa compartilhado: qualquer perfil com permissão pode editar
  // qualquer lançamento (a API valida o perfil na gravação)
  const transaction = await prisma.transaction.findFirst({
    where: { id },
  });

  if (!transaction) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/transactions"
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Transação</h1>
          <p className="text-gray-500 text-sm mt-0.5">Atualizar informações</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TransactionForm
          transactionId={transaction.id}
          initialData={{
            type: transaction.type,
            description: transaction.description,
            amount: transaction.amount,
            date: transaction.date.toISOString(),
            categoryId: transaction.categoryId,
            notes: transaction.notes,
          }}
        />
      </div>
    </div>
  );
}
