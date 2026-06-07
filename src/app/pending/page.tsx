"use client";

import { signOut } from "next-auth/react";
import { Clock, Building2, LogOut, RefreshCw } from "lucide-react";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 border-2 border-amber-200 rounded-2xl mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Aguardando Aprovação
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Sua conta está pendente de aprovação pelo administrador do sistema.
          </p>

          {/* Info card */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">
                Condomínio Bela Vista
              </span>
            </div>
            <p className="text-amber-700 text-xs leading-relaxed">
              O acesso ao sistema financeiro é restrito. Assim que o administrador
              aprovar seu cadastro, você receberá acesso completo ao painel.
            </p>
          </div>

          {/* Steps */}
          <div className="text-left space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-green-600 text-xs font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Conta criada</p>
                <p className="text-xs text-gray-400">Login via OAuth realizado</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-3 h-3 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Revisão pelo administrador</p>
                <p className="text-xs text-gray-400">Em andamento — normalmente em até 24h</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-gray-400 text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">Acesso liberado</p>
                <p className="text-xs text-gray-300">Após aprovação do administrador</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Verificar status
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
