/**
 * src/lib/roles.ts
 *
 * Matriz de perfis de acesso — constantes puras (sem dependência de banco/auth),
 * para serem reutilizadas pelo authz.ts e testadas isoladamente.
 *
 *   ADMIN     — tudo
 *   USER      — "Operador Completo": todas as funções financeiras
 *   OPERATOR  — importar extratos, categorizar e prestar contas
 *   READ_ONLY — somente leitura
 *   PENDING / REJECTED — nenhum acesso a dados
 */
export const ROLES_ADMIN  = ["ADMIN"];
export const ROLES_WRITE  = ["ADMIN", "USER"];
export const ROLES_IMPORT = ["ADMIN", "USER", "OPERATOR"];
export const ROLES_READ   = ["ADMIN", "USER", "OPERATOR", "READ_ONLY"];

/** O perfil está na lista de permitidos? (PENDING/REJECTED nunca passam) */
export function isAllowed(role: string | undefined | null, allowed: string[]): boolean {
  return !!role && allowed.includes(role);
}
