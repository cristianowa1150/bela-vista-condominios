import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacote autossuficiente para hospedagem compartilhada (cPanel):
  // .next/standalone contém server.js + node_modules mínimo já resolvido
  output: "standalone",
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
