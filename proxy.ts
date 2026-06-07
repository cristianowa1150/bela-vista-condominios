import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Paths that don't require authentication
  const publicPaths = ["/login", "/setup", "/api/auth", "/api/setup", "/pending", "/rejected"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Not logged in → go to login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but on login page → redirect based on role
  if (session && pathname === "/login") {
    const role = session.user.role;
    if (role === "PENDING") return NextResponse.redirect(new URL("/pending", request.url));
    if (role === "REJECTED") return NextResponse.redirect(new URL("/rejected", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session) {
    const role = session.user.role;

    // Pending users → only /pending allowed
    if (role === "PENDING" && !pathname.startsWith("/pending") && !pathname.startsWith("/api/auth")) {
      return NextResponse.redirect(new URL("/pending", request.url));
    }

    // Rejected users → only /rejected allowed
    if (role === "REJECTED" && !pathname.startsWith("/rejected") && !pathname.startsWith("/api/auth")) {
      return NextResponse.redirect(new URL("/rejected", request.url));
    }

    // Approved users trying to access /pending or /rejected → dashboard
    if ((role === "USER" || role === "ADMIN") && (pathname === "/pending" || pathname === "/rejected")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Non-admin trying to access /dashboard/admin
    if (role !== "ADMIN" && pathname.startsWith("/dashboard/admin")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
