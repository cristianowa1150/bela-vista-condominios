# Instalação no cPanel — contas.ibia.mg.gov.br

Deploy do Condomínio Bela Vista v2.0.0 em hospedagem cPanel compartilhada
(Application Manager / Phusion Passenger + MySQL 8).

> **Estratégia standalone:** a hospedagem compartilhada não tem memória para
> `npm install`/`npm run build` (OOM no CloudLinux). Por isso o pacote
> `bela-vista-v2.0.0-standalone.zip` já vem **compilado**, com `node_modules`
> mínimo embutido e cliente Prisma gerado para MySQL. **No servidor não se
> executa npm em momento algum.**

## Como gerar o pacote (na máquina de desenvolvimento)

```bash
npx prisma generate --schema prisma/schema.mysql.prisma
DATABASE_URL='mysql://...' npm run build
# montar: .next/standalone/* + .next/static + public + .env + app.js + schema-mysql.sql
```

O schema de produção é `prisma/schema.mysql.prisma` (tipos TEXT/LONGTEXT para
tokens OAuth, avatar e notas). O DDL `schema-mysql.sql` é gerado com
`prisma migrate diff --from-empty --to-schema prisma/schema.mysql.prisma --script`.

---

## Instalação no servidor

### 1. Banco de dados (já criado)

Banco `cristianowa1150_contas`, usuário `cristianowa1150_contas` com todos os
privilégios. As credenciais já estão no `.env` dentro do pacote — a senha
aparece **URL-encodada** (`%23` = `#`, `%26` = `&`); não altere.

### 2. Upload

No **Gerenciador de Arquivos**:

1. Crie a pasta **`contas-app`** na raiz da conta (fora de `public_html`)
2. Envie `bela-vista-v2.0.0-standalone.zip` para dentro dela e use **Extract**
3. Em *Settings* → **Show Hidden Files**, confirme que `.env` e `.next`
   foram extraídos

### 3. Criar as tabelas

No **Terminal**:

```bash
cd ~/contas-app
mysql -u cristianowa1150_contas -p cristianowa1150_contas < schema-mysql.sql
# digite a senha do banco quando pedir
```

Verifique: `mysql -u cristianowa1150_contas -p -e "SHOW TABLES" cristianowa1150_contas`
→ deve listar 8 tabelas (Account, AccountStatement, Category, ImportHistory,
Session, Transaction, User, VerificationToken).

### 4. Registrar no Application Manager

cPanel → **Application Manager** → *Editar* (ou *Register Application*):

| Campo | Valor |
|---|---|
| Application Name | Sistema Bela Vista |
| Deployment Domain | `contas.ibia.mg.gov.br` |
| Base Application URL | `/` |
| Application Path | `contas-app` (**não** `public_html`) |
| Deployment Environment | **Production** |

Em **Environment Variables**, adicione:

| Nome | Valor |
|---|---|
| `NODE_OPTIONS` | `--max-http-header-size=32768` |

Salve com **Deploy** e deixe **Habilitado**. O Passenger usa o `app.js` do
pacote como ponto de entrada (padrão fixo do Application Manager).

### 5. Iniciar e validar

```bash
mkdir -p ~/contas-app/tmp && touch ~/contas-app/tmp/restart.txt
```

1. Acesse `https://contas.ibia.mg.gov.br` (primeira carga ~30 s)
2. Vá em **`/setup`** e crie a conta de administrador (só funciona com o
   banco vazio de usuários)
3. Valide: login local, importação de extrato, relatório, painel admin
4. Teste Google e GitHub (entram como Pendente → aprovar no admin)

### 6. Backup diário (Cron Jobs, 02:00)

```bash
mkdir -p ~/backups
/usr/bin/mysqldump -u cristianowa1150_contas -p'SENHA_DO_BANCO' cristianowa1150_contas | gzip > ~/backups/contas-$(date +\%F).sql.gz
```

---

## Atualizações futuras

1. Gerar novo pacote standalone na máquina de desenvolvimento (ver topo)
2. Upload do zip → Extract por cima em `~/contas-app`
3. Se o schema mudou: aplicar o SQL de migração gerado por
   `prisma migrate diff` (do estado atual para o novo)
4. `touch ~/contas-app/tmp/restart.txt`

## Solução de problemas

| Sintoma | Ação |
|---|---|
| 503 / página de erro do Passenger | A página mostra o log; causas comuns: `.env` ausente (Show Hidden Files), Application Path errado |
| `node: command not found` ou versão < 20.9 | `node -v` no Terminal; peça ao provedor Node 20+ no CloudLinux |
| Listagem de arquivos em vez do site | Application Path apontando para `public_html` — corrija no passo 4 |
| `Access denied` no mysql | Senha digitada errada (a do `.env` é URL-encodada; no terminal use a senha real `WQGb#...` entre aspas simples) |
| OAuth `redirect_uri_mismatch` | Confirme `NEXTAUTH_URL` no `.env` e callbacks nos consoles Google/GitHub |
| HTTP 431 | Confirme `NODE_OPTIONS=--max-http-header-size=32768` no Application Manager |
| Sem cadeado HTTPS | AutoSSL pode demorar algumas horas para subdomínio novo; acione o provedor se persistir |
