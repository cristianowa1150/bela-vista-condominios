/**
 * Autorização por perfil nas rotas de API (defesa em profundidade — o proxy
 * protege as páginas, mas cada endpoint valida o perfil novamente).
 *
 * Matriz de permissões:
 *   ADMIN     — tudo
 *   USER      — "Operador Completo": todas as funções financeiras
 *   OPERATOR  — importar extratos, categorizar e prestar contas
 *   READ_ONLY — somente leitura
 *   PENDING / REJECTED — nenhum acesso a dados
 */
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { ROLES_ADMIN, ROLES_WRITE, ROLES_IMPORT, ROLES_READ, isAllowed } from "@/lib/roles";

// Reexporta as constantes de perfil (mantém as rotas importando de "@/lib/authz")
export { ROLES_ADMIN, ROLES_WRITE, ROLES_IMPORT, ROLES_READ };

type Authorized =
  | { session: Session & { user: { id: string; role: string } }; error: null }
  | { session: null; error: Response };

export async function authorize(allowed: string[]): Promise<Authorized> {
  const session = (await auth()) as (Session & { user: { id: string; role: string } }) | null;
  if (!session?.user?.id) {
    return {
      session: null,
      error: Response.json({ error: "Não autorizado" }, { status: 401 }),
    };
  }
  if (!isAllowed(session.user.role, allowed)) {
    return {
      session: null,
      error: Response.json(
        { error: "Seu perfil de acesso não permite esta operação" },
        { status: 403 }
      ),
    };
  }
  return { session, error: null };
}

export { round2 } from "@/lib/money";
