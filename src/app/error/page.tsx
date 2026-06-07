export default function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sessão inválida</h1>
        <p className="text-gray-500 text-sm mb-6">
          Seus cookies de sessão ficaram muito grandes. Clique abaixo para limpar e fazer login novamente.
        </p>
        <a
          href="/api/auth/clear"
          className="inline-block w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Limpar sessão e entrar
        </a>
      </div>
    </div>
  );
}
