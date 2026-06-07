import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { prisma } from "./prisma";

function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  const raw = url.startsWith("file:") ? url.slice(5) : url;
  return path.resolve(raw || "dev.db");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // ── Local admin (email + password) ──────────────────────────────
    Credentials({
      id: "credentials",
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        try {
          const db = new DatabaseSync(dbFilePath());
          const row = db
            .prepare(
              'SELECT id, name, email, image, role, password FROM "User" WHERE email = ? LIMIT 1'
            )
            .get(email) as {
              id: string;
              name: string | null;
              email: string;
              image: string | null;
              role: string;
              password: string | null;
            } | undefined;
          db.close();

          if (!row?.password) return null;

          const valid = await bcrypt.compare(password, row.password);
          if (!valid) return null;

          // Do NOT include image in the JWT — base64 avatars can be 50KB+
          // which makes the cookie exceed the 8KB HTTP header limit (HTTP 431).
          // The image is fetched directly from the DB in the dashboard layout.
          return {
            id: row.id,
            name: row.name,
            email: row.email,
            image: null,
            role: row.role,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),

    // ── OAuth providers ──────────────────────────────────────────────
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID ?? "common"}/v2.0`,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  events: {
    async createUser({ user }) {
      try {
        const othersCount = await prisma.user.count({
          where: { id: { not: user.id } },
        });
        if (othersCount === 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
        }
      } catch (err) {
        console.error("[auth] createUser event error:", err);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const role = (user as { role?: string }).role;
        if (role) {
          token.role = role;
        } else {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id! },
              select: { role: true },
            });
            token.role = dbUser?.role ?? "PENDING";
          } catch {
            token.role = "PENDING";
          }
        }
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string ?? "PENDING") as
          | "ADMIN"
          | "USER"
          | "PENDING"
          | "REJECTED";
        // Strip image from session to keep cookie small.
        // Image is loaded from the DB in the dashboard layout server component.
        if (
          typeof session.user.image === "string" &&
          session.user.image.startsWith("data:")
        ) {
          session.user.image = null;
        }
      }
      return session;
    },
  },
});
