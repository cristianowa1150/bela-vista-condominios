/**
 * server.js — Arquivo de inicialização para cPanel (Phusion Passenger).
 *
 * No cPanel → "Setup Node.js App", aponte "Application startup file" para
 * este arquivo. O Passenger define process.env.PORT automaticamente.
 *
 * Não passa pelo compilador do Next — mantenha sintaxe CommonJS pura.
 */
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`[bela-vista] servidor pronto na porta ${port}`);
  });
});
