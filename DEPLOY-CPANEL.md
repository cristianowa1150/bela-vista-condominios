# Instalação no cPanel — contas.ibia.mg.gov.br

Guia de deploy do Condomínio Bela Vista v2.0.0 em hospedagem cPanel com
**Setup Node.js App** (Phusion Passenger) e **MySQL 8**.

> Pré-requisitos confirmados no servidor: cPanel 134, MySQL 8.4, Node.js App
> habilitado com **Node ≥ 20.9** (exigência do Next.js 16).

---

## 1. Banco de dados MySQL

No cPanel → **Bancos de Dados MySQL®**:

1. **Criar banco**: `contas` → o cPanel prefixa, ex.: `ibia_contas`
2. **Criar usuário**: `contas_app` com senha forte (gere e anote)
3. **Adicionar usuário ao banco** com **TODOS OS PRIVILÉGIOS**

Anote: `mysql://ibia_contas__app:SENHA@localhost:3306/ibia_contas`
(use os nomes exatos com prefixo que o cPanel mostrar).

## 2. Upload dos arquivos

1. cPanel → **Gerenciador de Arquivos** → crie a pasta **`contas-app`** na
   raiz da conta (**fora** de `public_html` — o código não deve ser servido
   como arquivo estático)
2. Faça upload do `bela-vista-v2.0.0-cpanel.zip` para dentro dela
3. Clique com o botão direito → **Extract**

## 3. Criar a aplicação Node.js

cPanel → **Setup Node.js App** → **Create Application**:

| Campo | Valor |
|---|---|
| Node.js version | **20.x ou superior** (mínimo 20.9) |
| Application mode | **Production** |
| Application root | `contas-app` |
| Application URL | `contas.ibia.mg.gov.br` |
| Application startup file | `server.js` |

Clique em **Create**. O Passenger conecta o subdomínio à aplicação
automaticamente (não é preciso configurar o Apache).

## 4. Variáveis de ambiente

O pacote zip já inclui um arquivo **`.env`** na raiz com todos os valores
preenchidos (banco, AUTH_SECRET, OAuth Google/GitHub) — o Next.js o lê
automaticamente. Confirme que ele foi extraído junto (no Gerenciador de
Arquivos, ative **Settings → Show Hidden Files** para vê-lo).

> A senha do banco contém caracteres especiais (`#`, `&`) e por isso aparece
> **URL-encodada** na `DATABASE_URL` (`%23`, `%26`) — não "corrija" isso.

Apenas **uma** variável precisa ser cadastrada na tela do Setup Node.js App
(em **Environment variables**), pois é uma flag do Node e não do app:

| Nome | Valor |
|---|---|
| `NODE_OPTIONS` | `--max-http-header-size=32768` |

⚠️ O `.env` contém segredos: nunca o copie para `public_html` nem o envie
para o GitHub (já está no `.gitignore`).

## 5. Instalar, migrar e compilar

A tela do Setup Node.js App mostra um comando *"Enter to the virtual
environment"* — copie-o. Abra o cPanel → **Terminal** e execute:

```bash
# 1. Entrar no ambiente da aplicação (cole o comando copiado), ex.:
source /home/USUARIO/nodevenv/contas-app/20/bin/activate && cd /home/USUARIO/contas-app

# 2. Instalar dependências
npm ci

# 3. Apontar o Prisma para MySQL e criar as tabelas
npm run db:mysql
npx prisma generate
npx prisma db push

# 4. Rodar a suíte de testes (39 casos — deve terminar com "0 falharam")
npm test

# 5. Compilar para produção
npm run build
```

> `db push` cria todas as tabelas direto do schema — as migrações do
> repositório são específicas de SQLite (dev) e não devem ser usadas no MySQL.

## 6. Iniciar e validar

1. Volte ao **Setup Node.js App** → botão **Restart**
2. cPanel → **SSL/TLS Status** → confirme que `contas.ibia.mg.gov.br` tem
   certificado AutoSSL válido (cadeado verde)
3. Acesse `https://contas.ibia.mg.gov.br` → deve redirecionar para `/login`
4. Acesse `/setup` e **crie a conta de administrador** (só funciona enquanto
   não existir nenhum usuário)
5. Faça login e teste: importação de um extrato, relatório, painel admin
6. Teste o login Google e GitHub (entram como **Pendente**; aprove no admin)

## 7. Backup automático (recomendado)

cPanel → **Cron Jobs** → adicionar, diário às 02:00:

```bash
/usr/bin/mysqldump -u USUARIO -p'SENHA' BANCO | gzip > /home/USUARIO/backups/contas-$(date +\%F).sql.gz
```

(crie antes a pasta `backups`; mantenha ao menos 30 dias de arquivos)

---

## Atualizações futuras

```bash
# no Terminal, dentro do virtualenv e da pasta contas-app:
git pull            # ou upload do novo zip por cima
npm ci
npm run db:mysql && npx prisma generate && npx prisma db push
npm test && npm run build
```
Depois **Restart** no Setup Node.js App.

## Solução de problemas

| Sintoma | Causa provável / ação |
|---|---|
| Erro 503 / "Passenger could not start" | Veja o log na tela do Node.js App; geralmente variável de ambiente faltando ou `npm run build` não executado |
| `PrismaClientInitializationError` | `DATABASE_URL` incorreta ou `npm run db:mysql` + `prisma generate` não executados |
| Login OAuth com `redirect_uri_mismatch` | Confirme `NEXTAUTH_URL=https://contas.ibia.mg.gov.br` e as callbacks nos consoles Google/GitHub |
| HTTP 431 | Confirme `NODE_OPTIONS=--max-http-header-size=32768`; em último caso acesse `/api/auth/clear` |
| Node < 20.9 indisponível no seletor | Peça ao provedor para instalar Node 20/22 no CloudLinux |
