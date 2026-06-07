"use client";

import { signOut } from "next-auth/react";
import { XCircle, Building2, LogOut } from "lucide-react";

export default function RejectedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl border border-red-200 shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 border-2 border-red-200 rounded-2xl mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Acesso Negado
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Seu acesso ao sistema foi rejeitado pelo administrador.
          </p>

          {/* Info card */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-800 text-sm">
                Condomínio Bela Vista
              </span>
            </div>
            <p className="text-red-700 text-xs leading-relaxed">
              Sua solicitação de acesso foi recusada. Se acredita que isso é um
              erro, entre em contato diretamente com o administrador do condomínio.
            </p>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair do sistema
          </button>
        </div>
      </div>
    </div>
  );
}
