import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude native/libsql packages from Turbopack bundling so Node.js loads them natively
  serverExternalPackages: [
    "@libsql/client",
    "@prisma/adapter-libsql",
    "@prisma/adapter-mariadb",
    "mariadb",
    "pdf-parse",
    "better-sqlite3",
  ],
};

export default nextConfig;
