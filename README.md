# 🏢 Condomínio Bela Vista — Sistema de Gestão Financeira

[![Versão](https://img.shields.io/badge/versão-2.1.1-blue)](./CHANGELOG.md)
[![Licença](https://img.shields.io/badge/licença-CC%20BY%204.0-green)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![MySQL](https://img.shields.io/badge/banco-MySQL%208-orange)](https://mysql.com)

Sistema web completo de gestão financeira para condomínios, com dashboard, transações, relatórios, importação de extratos e controle de acesso por perfis.

> **Licença:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE) — use, adapte e distribua livremente dando os devidos créditos.

---

## ✨ Funcionalidades

- **Dashboard** com gráficos de receitas, despesas, saldo e categorias por período
- **Transações** — cadastro, edição, filtro por período, paginação até 300 registros
- **Importação** de extratos bancários via CSV, OFX, PDF e TXT, com
  deduplicação automática (hash do arquivo + transação a transação) que
  permite complementar meses em aberto com extratos parciais
- **Prestação de Contas** — relatórios mensais por caixa/banco
- **Relatórios** — exportação em PDF e Excel
- **Categorias** personalizadas com cores
- **Perfis de acesso**: Administrador, Operador Completo, Operador, Somente Leitura, Rejeitado
- **Autenticação** local (e-mail + senha) e OAuth (Google, GitHub)
- **Temas visuais**: Claro, Escuro, Sépia, Apple (glassmorphism)
- **Personalização**: 9 paletas de menu, foto de perfil, ícone do menu, favicon e fundo de login (Bing foto do dia)

---

## 🛠️ Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 — App Router |
| Linguagem | TypeScript 5 |
| Estilo | Tailwind CSS v4 |
| ORM | Prisma 7 |
| Banco | MySQL 8 (produção) · SQLite (desenvolvimento opcional) |
| Autenticação | NextAuth v5 beta — JWT strategy |
| Gráficos | Recharts |
| PDF / Excel | jsPDF · xlsx + PapaParse |

---

## 📋 Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20.x |
| npm | 10.x |
| MySQL | 8.x (produção) |
| Git | qualquer |

```bash
node -v && npm -v && git -v
```

---

## 🚀 Desenvolvimento local

### 1. Clone e instale

```bash
git clone https://github.com/cristianowa1150/bela-vista-condominios.git
cd bela-vista-condominios
npm install
```

### 2. Configure `.env.local`

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com os valores do seu ambiente.  
**Mínimo para rodar localmente** (com MySQL):

```env
DATABASE_URL="mysql://root:senha@localhost:3306/bela_vista"
AUTH_SECRET="gere-com-openssl-rand-base64-32"
```

> **Gerar AUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> ```

### 3. Crie o banco e aplique as migrações

```bash
# Criar banco no MySQL
mysql -u root -p -e "CREATE DATABASE bela_vista CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Gerar cliente Prisma e aplicar schema
npm run db:generate
npm run db:migrate
```

### 4. Inicie o servidor

```bash
npm run dev
# → http://localhost:3000
```

### 5. Primeiro acesso

Acesse [http://localhost:3000/setup](http://localhost:3000/setup) para criar o administrador inicial.  
O primeiro usuário cadastrado recebe automaticamente o perfil **Administrador**.

---

## 🐧 Deploy em servidor Linux com MySQL

Guia completo para Ubuntu 22.04 LTS / Debian 12.  
Substitua `seudominio.com` e os dados de banco pelos seus valores reais.

### 1. Atualizar o sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Node.js 20 via NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve ser v20.x
```

### 3. Instalar MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation   # configure senha root e remova usuários anônimos
```

Criar banco e usuário dedicado:

```sql
sudo mysql -u root -p

CREATE DATABASE bela_vista
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'bv_user'@'localhost' IDENTIFIED BY 'SenhaForte123!';
GRANT ALL PRIVILEGES ON bela_vista.* TO 'bv_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Instalar PM2

```bash
sudo npm install -g pm2
```

### 5. Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

### 6. Clonar o projeto

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/cristianowa1150/bela-vista-condominios.git
sudo chown -R $USER:$USER /var/www/bela-vista-condominios
cd bela-vista-condominios
```

### 7. Instalar dependências

```bash
npm install --omit=dev
```

### 8. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
nano .env.local
```

Preencha **todos** os campos:

```env
DATABASE_URL="mysql://bv_user:SenhaForte123!@localhost:3306/bela_vista"
AUTH_SECRET="resultado-do-openssl-rand-base64-32"
NEXTAUTH_URL="https://seudominio.com"

# OAuth — configure apenas os provedores que quiser usar
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

### 9. Gerar cliente Prisma e aplicar migrações

```bash
npm run db:generate
npm run db:deploy     # aplica migrações sem perguntar (modo produção)
```

### 10. Build de produção

```bash
npm run build
```

### 11. Iniciar com PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup        # exibe o comando para auto-iniciar no boot — execute-o

# Verificar se está rodando:
pm2 status
pm2 logs bela-vista
```

### 12. Configurar Nginx como reverse proxy

```bash
sudo nano /etc/nginx/sites-available/bela-vista
```

Cole o conteúdo abaixo:

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    # Redireciona HTTP → HTTPS (após configurar SSL)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

Ativar o site:

```bash
sudo ln -s /etc/nginx/sites-available/bela-vista /etc/nginx/sites-enabled/
sudo nginx -t          # testar configuração
sudo systemctl reload nginx
```

### 13. SSL com Let's Encrypt (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

Após o Certbot configurar o SSL, descomente a linha de redirect no Nginx e recarregue:

```bash
sudo systemctl reload nginx
```

O Certbot renova automaticamente via cron/systemd.

### 14. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### ✅ Checklist de produção

- [ ] `AUTH_SECRET` gerado com `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` apontando para a URL com HTTPS
- [ ] Banco MySQL criado com usuário dedicado (não root)
- [ ] `npm run db:deploy` executado após cada atualização
- [ ] PM2 configurado com `pm2 startup` + `pm2 save`
- [ ] Nginx com proxy reverso e SSL ativo
- [ ] Firewall habilitado (apenas portas 22, 80, 443 abertas)
- [ ] Backup automático do banco configurado

---

## 🔄 Atualizando o sistema em produção

```bash
cd /var/www/bela-vista-condominios

# Buscar novas versões
git pull origin main

# Instalar dependências novas (se houver)
npm install --omit=dev

# Aplicar novas migrações de banco
npm run db:deploy

# Rebuild e reiniciar
npm run build
pm2 restart bela-vista
```

---

## 🔐 Configuração do OAuth (opcional)

URLs de callback para produção — substitua `seudominio.com`:

| Provedor | URL de callback |
|---|---|
| Google | `https://seudominio.com/api/auth/callback/google` |
| GitHub | `https://seudominio.com/api/auth/callback/github` |

### Google

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Crie projeto → **Tela de consentimento OAuth** (externo)
3. **Credenciais → OAuth → Aplicativo da Web**
4. Adicione as URLs de redirecionamento (desenvolvimento e produção)
5. Copie Client ID e Client Secret para `.env.local`

### GitHub

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Callback URL: `https://seudominio.com/api/auth/callback/github`
3. Gere um Client Secret

---

## 📁 Estrutura do projeto

```
bela-vista-condominios/
├── src/
│   ├── app/
│   │   ├── api/                  # API Routes
│   │   │   ├── admin/            # Gerenciamento de usuários
│   │   │   ├── bing-bg/          # Proxy fotos do dia (Bing)
│   │   │   ├── auth/clear/       # Rota de emergência — limpa cookies
│   │   │   ├── categories/       # CRUD categorias
│   │   │   ├── dashboard/        # Dados do painel
│   │   │   ├── transactions/     # CRUD transações
│   │   │   └── user/profile/     # Foto de perfil
│   │   ├── dashboard/            # Páginas protegidas
│   │   │   ├── admin/            # Administração de usuários
│   │   │   ├── categories/       # Gestão de categorias
│   │   │   ├── import/           # Importação de extratos
│   │   │   ├── prestacao/        # Prestação de contas
│   │   │   ├── reports/          # Relatórios
│   │   │   └── transactions/     # Transações
│   │   ├── login/                # Tela de login (Bing + glass)
│   │   └── setup/                # Cadastro do primeiro admin
│   ├── components/
│   │   ├── layout/               # Shell, Sidebar, Header, Temas, Favicon
│   │   └── ui/                   # Componentes reutilizáveis
│   └── lib/
│       ├── auth.ts               # Configuração NextAuth
│       ├── prisma.ts             # Instância do Prisma Client
│       ├── compress-image.ts     # Compressão de imagens via Canvas
│       └── utils.ts              # Utilitários
├── prisma/
│   ├── schema.prisma             # Schema MySQL
│   └── migrations/               # Histórico de migrações
├── ecosystem.config.js           # Configuração PM2
├── .env.local.example            # Template de variáveis de ambiente
├── .gitignore
├── CHANGELOG.md
├── LICENSE                       # CC BY 4.0
└── README.md
```

---

## 🧑‍💻 Guia para colaboradores

### Fluxo de trabalho

```bash
# Fork → clone → branch
git clone https://github.com/SEU-USUARIO/bela-vista-condominios.git
cd bela-vista-condominios
git remote add upstream https://github.com/cristianowa1150/bela-vista-condominios.git
git checkout -b feat/nome-da-feature

# Desenvolver → commit → push → PR
git commit -m "feat: descrição clara da mudança"
git push origin feat/nome-da-feature
```

### Convenções de commit

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Refatoração |
| `style:` | CSS / formatação |
| `docs:` | Documentação |
| `chore:` | Dependências / config |

### Pontos críticos — leia antes de codar

| Ponto | Regra |
|---|---|
| **Next.js 16** | Leia `node_modules/next/dist/docs/` — há breaking changes |
| **App Router** | Sem `pages/` — tudo em `src/app/` |
| **Server Components** | Padrão; use `"use client"` só quando necessário |
| **Hydration** | Nunca leia `localStorage` em `useState()` — use `useEffect` |
| **Tailwind v4** | Overrides precisam de `!important` |
| **JWT / cookies** | Nunca coloque base64 de imagens no token |
| **MySQL** | Campos grandes precisam de `@db.Text` / `@db.LongText` no schema |

### Como expandir

| O que adicionar | Onde mexer |
|---|---|
| Novo perfil de usuário | `VALID_ROLES` em `api/admin/users/route.ts` · `ROLE_CONFIG` em `admin/page.tsx` · `roles` em `sidebar.tsx` |
| Nova página | `navItems` em `sidebar.tsx` + pasta em `src/app/dashboard/` |
| Novo tema visual | `globals.css` (`[data-theme="nome"]`) + `theme-selector.tsx` |
| Nova paleta sidebar | `sidebar-palettes.ts` (incluído automaticamente) |
| Novo provedor OAuth | `auth.ts` + botão em `login/page.tsx` + vars em `.env.local` |
| Novo modelo de banco | `schema.prisma` + `npx prisma migrate dev` |

### Verificando antes do PR

```bash
npm run build        # build sem erros
npx tsc --noEmit    # verificação de tipos
npm run db:studio   # inspecionar banco via GUI
```

---

## 🐛 Solução de problemas

### HTTP 431 — Request Header Fields Too Large

Sessão antiga com imagem base64 no cookie JWT.

```
# Limpar cookies — acesse no navegador:
http://localhost:3000/api/auth/clear
```

### Hydration mismatch no React

```tsx
// ❌ Errado
const [v, setV] = useState(() => localStorage.getItem("k"));

// ✅ Correto
const [v, setV] = useState("padrão");
useEffect(() => { const s = localStorage.getItem("k"); if (s) setV(s); }, []);
```

### Erro de conexão com o banco

```bash
# Verificar se MySQL está rodando
sudo systemctl status mysql

# Testar conexão
mysql -u bv_user -p -h localhost bela_vista
```

### Prisma: cliente desatualizado após alterar o schema

```bash
npm run db:generate
npm run db:migrate   # dev
# ou
npm run db:deploy    # produção
```

### PM2 não inicia após reboot

```bash
pm2 startup     # siga as instruções do comando
pm2 save
```

---

## 📜 Licença

**[Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE)**

✅ Usar · ✅ Adaptar · ✅ Distribuir — inclusive comercialmente  
📌 **Crédito obrigatório** ao projeto e autor(es) originais  
📌 **Indique alterações** feitas no código  
📌 **Mantenha a licença** em projetos derivados

### Crédito mínimo exigido

```
Baseado em: Condomínio Bela Vista — Sistema de Gestão Financeira
Repositório: https://github.com/cristianowa1150/bela-vista-condominios
Licença: CC BY 4.0
```

---

## 🤝 Créditos

Desenvolvido por [Cristiano](https://github.com/cristianowa1150) com assistência de [Claude (Anthropic)](https://claude.ai).

Veja o histórico completo de mudanças em [CHANGELOG.md](./CHANGELOG.md).

---

<p align="center">
  <a href="https://creativecommons.org/licenses/by/4.0/">
    <img src="https://licensebuttons.net/l/by/4.0/88x31.png" alt="CC BY 4.0" />
  </a>
</p>
