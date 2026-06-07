import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import TransactionForm from "@/components/transactions/transaction-form";

export default function NewTransactionPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Nova Transação</h1>
          <p className="text-gray-500 text-sm mt-0.5">Registrar receita ou despesa</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TransactionForm />
      </div>
    </div>
  );
}
