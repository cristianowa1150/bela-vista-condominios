# 🏢 Condomínio Bela Vista — Sistema de Gestão Financeira

Sistema web completo de gestão financeira para condomínios, desenvolvido com Next.js 16, Prisma, NextAuth e Tailwind CSS v4.

> **Licença:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE) — use, adapte e distribua livremente dando os devidos créditos.

---

## ✨ Funcionalidades

- **Dashboard** com gráficos de receitas, despesas, saldo e categorias
- **Transações** — cadastro, edição, filtro por período e paginação até 300 registros
- **Importação** de extratos bancários via CSV/OFX
- **Prestação de Contas** — relatórios mensais por caixa/banco
- **Relatórios** — exportação em PDF e Excel
- **Categorias** personalizadas com cores
- **Administração** de usuários com perfis: Administrador, Operador Completo, Operador, Somente Leitura, Rejeitado
- **Autenticação** local (e-mail + senha) e OAuth (Google, GitHub, Microsoft)
- **Temas visuais**: Claro, Escuro, Sépia, Apple (glassmorphism)
- **Personalização**: 9 paletas de cores para o menu, foto de perfil, ícone do menu, favicon da aba e fundo da tela de login (Bing foto do dia)

---

## 🛠️ Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) — App Router |
| Linguagem | TypeScript 5 |
| Estilo | Tailwind CSS v4 |
| ORM | Prisma 7 |
| Banco de dados | SQLite (`dev.db`) em desenvolvimento |
| Autenticação | NextAuth v5 (beta) — JWT strategy |
| Gráficos | Recharts |
| PDF | jsPDF |
| Excel | xlsx + PapaParse |

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:

- **Node.js** ≥ 20.x — [nodejs.org](https://nodejs.org)
- **npm** ≥ 10 (vem com o Node.js)
- **Git** — [git-scm.com](https://git-scm.com)

Verifique as versões:

```bash
node -v   # deve ser v20.x ou superior
npm -v    # deve ser v10.x ou superior
git -v
```

---

## 🚀 Instalação e configuração

### 1. Clone o repositório

```bash
git clone https://github.com/cristianowa1150/bela-vista-condominios.git
cd bela-vista-condominios
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto (nunca commite este arquivo):

```env
# Banco de dados SQLite
DATABASE_URL="file:./dev.db"

# Segredo do NextAuth — gere com: openssl rand -base64 32
AUTH_SECRET="seu-segredo-aqui-minimo-32-caracteres"

# ── OAuth Google (opcional) ───────────────────────────────────────────────
# Obtenha em: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ── OAuth GitHub (opcional) ───────────────────────────────────────────────
# Obtenha em: https://github.com/settings/developers
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# ── OAuth Microsoft (opcional) ────────────────────────────────────────────
# Obtenha em: https://portal.azure.com → Registros de aplicativos
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID="common"
```

> **Gerar AUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> # ou: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```

### 4. Configure o banco de dados

```bash
# Gera o cliente Prisma
npx prisma generate

# Cria o banco de dados e aplica as migrações
npx prisma migrate dev --name init
```

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### 6. Crie o primeiro administrador

Acesse [http://localhost:3000/setup](http://localhost:3000/setup) para criar a conta de administrador inicial.

> O primeiro usuário cadastrado recebe automaticamente o perfil **Administrador**.

---

## 🔐 Configuração do OAuth (opcional)

A URL de callback padrão é `http://localhost:3000/api/auth/callback/<provedor>`.

### Google

1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Crie um projeto → **APIs e Serviços → Tela de consentimento OAuth** → tipo Externo
3. **Credenciais → Criar credencial → ID do cliente OAuth → Aplicativo da Web**
4. URI de redirecionamento autorizado: `http://localhost:3000/api/auth/callback/google`
5. Copie **Client ID** e **Client Secret** para o `.env.local`

### GitHub

1. Acesse [github.com/settings/developers](https://github.com/settings/developers)
2. **New OAuth App**
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copie **Client ID** e gere um **Client Secret**

### Microsoft

1. Acesse [portal.azure.com](https://portal.azure.com) → **Registros de aplicativos → Novo registro**
2. Tipos de conta: *Contas em qualquer diretório e contas pessoais Microsoft*
3. URI de redirecionamento (Web): `http://localhost:3000/api/auth/callback/microsoft-entra-id`
4. Copie o **ID do aplicativo** → `AZURE_AD_CLIENT_ID`
5. **Certificados e segredos → Novo segredo** → copie o **Valor** → `AZURE_AD_CLIENT_SECRET`

---

## 🏗️ Build para produção

```bash
npm run build
npm run start
```

Para produção, configure também:
- `NEXTAUTH_URL` com a URL pública do servidor (ex: `https://seudominio.com`)
- Banco de dados em servidor dedicado (PostgreSQL recomendado)

### Deploy com Docker (exemplo)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 📁 Estrutura do projeto

```
bela-vista-condominios/
├── src/
│   ├── app/                    # Rotas e páginas (Next.js App Router)
│   │   ├── api/                # API Routes
│   │   │   ├── admin/          # Gerenciamento de usuários
│   │   │   ├── bing-bg/        # Proxy imagens do dia (Bing)
│   │   │   ├── categories/     # CRUD de categorias
│   │   │   ├── dashboard/      # Dados do painel
│   │   │   ├── transactions/   # CRUD de transações
│   │   │   └── user/profile/   # Foto de perfil
│   │   ├── dashboard/          # Páginas protegidas do sistema
│   │   │   ├── admin/          # Administração de usuários
│   │   │   ├── categories/     # Gestão de categorias
│   │   │   ├── import/         # Importação de extratos
│   │   │   ├── prestacao/      # Prestação de contas
│   │   │   ├── reports/        # Relatórios
│   │   │   └── transactions/   # Transações
│   │   ├── login/              # Tela de login (fundo Bing + glass)
│   │   └── setup/              # Cadastro do primeiro admin
│   ├── components/
│   │   ├── layout/             # Shell, Sidebar, Header, Temas, Favicon
│   │   └── ui/                 # Componentes reutilizáveis
│   └── lib/                    # Utilitários (auth, prisma, utils)
├── prisma/
│   ├── schema.prisma           # Schema do banco de dados
│   └── migrations/             # Migrações do Prisma
├── public/                     # Arquivos estáticos
├── .env.local                  # Variáveis de ambiente (NÃO commitado)
├── .gitignore
├── LICENSE                     # CC BY 4.0
└── README.md
```

---

## 🧑‍💻 Guia para colaboradores

Obrigado pelo interesse em contribuir! Siga estas orientações para manter a qualidade e consistência do código.

### Fluxo de trabalho

```bash
# 1. Faça um fork do repositório no GitHub

# 2. Clone seu fork
git clone https://github.com/SEU-USUARIO/bela-vista-condominios.git
cd bela-vista-condominios

# 3. Adicione o repositório original como upstream
git remote add upstream https://github.com/cristianowa1150/bela-vista-condominios.git

# 4. Crie uma branch para sua feature ou correção
git checkout -b feat/nome-da-feature
# ou
git checkout -b fix/descricao-do-bug

# 5. Desenvolva, faça commit e push
git add .
git commit -m "feat: descrição clara da mudança"
git push origin feat/nome-da-feature

# 6. Abra um Pull Request para a branch main do repositório original
```

### Convenções de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Refatoração sem mudança de comportamento |
| `style:` | Apenas formatação / CSS |
| `docs:` | Documentação |
| `chore:` | Configuração, dependências |

### ⚠️ Pontos críticos — leia antes de codar

> Este projeto usa **Next.js 16** com breaking changes em relação a versões anteriores.
> Leia `node_modules/next/dist/docs/` antes de escrever qualquer código.

| Ponto | Regra |
|---|---|
| **App Router** | Sem `pages/` — tudo em `src/app/` |
| **Server Components** | São o padrão. Use `"use client"` só quando necessário |
| **Hydration mismatch** | Nunca leia `localStorage` em `useState()`. Sempre use `useEffect` |
| **Tailwind v4** | Overrides de utilitários precisam de `!important` |
| **NextAuth v5** | JWT strategy — nunca coloque base64 de imagens no token JWT |
| **Cookie size** | Mantenha o JWT pequeno — imagens vão no banco, não no cookie |

### Como expandir o sistema

| O que adicionar | Onde mexer |
|---|---|
| Novo perfil de usuário | `VALID_ROLES` em `api/admin/users/route.ts` + `ROLE_CONFIG` em `dashboard/admin/page.tsx` + `navItems` roles em `sidebar.tsx` |
| Nova página | Array `navItems` em `sidebar.tsx` + nova pasta em `src/app/dashboard/` |
| Novo tema visual | `globals.css` (bloco `[data-theme="nome"]`) + `theme-selector.tsx` |
| Nova paleta de sidebar | `sidebar-palettes.ts` (auto-incluído no picker e no inline script do layout) |
| Novo provedor OAuth | `src/lib/auth.ts` + botão em `login/page.tsx` + variáveis em `.env.local` |

### Verificando antes do PR

```bash
# Build sem erros de compilação
npm run build

# Verificação de tipos TypeScript
npx tsc --noEmit

# Inspecionar banco de dados via GUI
npx prisma studio
```

---

## 🐛 Solução de problemas comuns

### HTTP 431 — Request Header Fields Too Large
Sessão antiga com imagem base64 no cookie.

```
# Limpe os cookies acessando:
http://localhost:3000/api/auth/clear
```

### Banco de dados não encontrado
```bash
npx prisma migrate dev
```

### Hydration mismatch no React
```tsx
// ❌ Errado — lê localStorage no servidor (undefined) e no cliente (valor salvo)
const [val, setVal] = useState(() => localStorage.getItem("key"));

// ✅ Correto — começa com default determinístico, carrega no cliente após montar
const [val, setVal] = useState("default");
useEffect(() => {
  const saved = localStorage.getItem("key");
  if (saved) setVal(saved);
}, []);
```

### Prisma: cliente desatualizado após mudança no schema
```bash
npx prisma generate
npx prisma migrate dev
```

---

## 📜 Licença

Este projeto está licenciado sob a **[Creative Commons Attribution 4.0 International (CC BY 4.0)](./LICENSE)**.

**Você é livre para:**
- ✅ **Usar** — para qualquer finalidade, incluindo comercial
- ✅ **Adaptar** — modificar, transformar e criar projetos derivados
- ✅ **Distribuir** — redistribuir o original ou suas adaptações

**Desde que você:**
- 📌 **Dê crédito** ao projeto e ao(s) autor(es) originais
- 📌 **Indique alterações** — deixe claro o que foi modificado
- 📌 **Mantenha a licença** — inclua o arquivo `LICENSE` no projeto derivado

### Crédito mínimo exigido

```
Baseado em: Condomínio Bela Vista — Sistema de Gestão Financeira
Repositório: https://github.com/cristianowa1150/bela-vista-condominios
Licença: CC BY 4.0
```

---

## 🤝 Créditos

Desenvolvido por [Cristiano](https://github.com/cristianowa1150) com assistência de [Claude (Anthropic)](https://claude.ai).

---

<p align="center">
  <a href="https://creativecommons.org/licenses/by/4.0/">
    <img src="https://licensebuttons.net/l/by/4.0/88x31.png" alt="Licença CC BY 4.0" />
  </a>
</p>
