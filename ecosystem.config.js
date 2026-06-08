/**
 * PM2 Ecosystem — Condomínio Bela Vista
 *
 * Uso:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "bela-vista",
      script: "./node_modules/next/dist/bin/next",
      args: "start",
      node_args: "--max-http-header-size=32768",
      cwd: "./",
      instances: 1,          // aumente para "max" em servidores com múltiplos núcleos
      exec_mode: "fork",     // use "cluster" se instances > 1
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
