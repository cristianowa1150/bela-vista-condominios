import { NextResponse } from "next/server";

/**
 * GET /api/auth/clear
 *
 * Emergency route: clears all NextAuth session cookies and redirects to /login.
 * Use when the JWT cookie is too large (HTTP 431 error).
 */
export async function GET() {
  const res = NextResponse.redirect(
    new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000")
  );

  // NextAuth v5 cookie names
  const cookieNames = [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
    "authjs.pkce.code_verifier",
    "__Secure-authjs.session-token",
    "__Secure-authjs.csrf-token",
    "__Host-authjs.csrf-token",
    // Legacy names
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
  ];

  for (const name of cookieNames) {
    res.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return res;
}
