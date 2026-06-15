/**
 * src/lib/auth-logic.ts
 *
 * Decisões puras do login por credenciais (e-mail + senha) — isoladas do banco
 * e do bcrypt para serem testáveis de forma determinística. A verificação de
 * senha (bcrypt.compare) e a busca no banco ficam em auth.ts; aqui mora a
 * lógica de segurança: normalização, elegibilidade e a forma do usuário de
 * sessão (garantindo image: null para não estourar o cookie JWT — HTTP 431).
 */

export interface CredentialUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  password: string | null;
}

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: null;
  role: string;
}

/** Normaliza o e-mail de login: trim + minúsculas. Vazio/indefinido → null. */
export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

/** Credenciais mínimas presentes? (e-mail normalizável + senha não-vazia) */
export function hasCredentials(rawEmail: unknown, rawPassword: unknown): boolean {
  return normalizeLoginEmail(rawEmail) !== null &&
    typeof rawPassword === "string" && rawPassword.length > 0;
}

/**
 * O usuário pode autenticar por senha? Só se existir e tiver hash de senha —
 * contas exclusivamente OAuth (password null) não logam por credenciais.
 */
export function isCredentialEligible(
  user: CredentialUser | null | undefined
): user is CredentialUser & { password: string } {
  return !!user && typeof user.password === "string" && user.password.length > 0;
}

/**
 * Monta o usuário de sessão a partir do registro do banco.
 * NUNCA inclui a imagem (base64 pode passar de 50KB e estourar o header HTTP).
 */
export function buildSessionUser(user: CredentialUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: null,
    role: user.role,
  };
}
