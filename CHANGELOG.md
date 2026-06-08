# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.0.0] — 2026-06-08

> Primeira versão de produção. Migração de SQLite/libsql para MySQL nativo,
> remoção de dependências experimentais do Node.js e configuração completa
> para deploy em servidor Linux.

### Adicionado
- **Tema Apple / glassmorphism** — 4º tema visual com gradiente macOS Sequoia,
  backdrop-blur em cards, header e sidebar, fonte SF Pro / -apple-system
- **Paleta Cristal** para sidebar — tons translúcidos para o tema Apple;
  troca automática ao ativar o tema Apple e restauração ao sair
- **Seletor de favicon** — upload de ícone personalizado para a aba do navegador,
  comprimido para 64×64 px, persistido em localStorage e reaplicado antes do
  primeiro paint via inline script no `<head>`
- **Tela de login redesenhada** — fundo full-screen com foto do dia do Bing
  (seletor de thumbnails, navegação prev/next, créditos), cards glass-morphism
  no estilo iOS/macOS
- **API proxy `/api/bing-bg`** — busca as últimas 8 fotos do Bing sem CORS,
  cache de 1 hora no servidor
- **Rota de emergência `/api/auth/clear`** — limpa todos os cookies de sessão
  NextAuth (v4 e v5) e redireciona para `/login`; resolve HTTP 431
- **Seletor de período e registros por página** nas transações — filtros de
  Mês Atual, Mês Anterior, 3/6/12 Meses, Personalizado; paginação até 300
  registros por página
- **Atribuição de perfis pelo admin** — dropdown por usuário para definir
  ADMIN, USER, OPERATOR, READ_ONLY ou REJECTED
- **Sidebar recolhível e responsiva** — botão hamburger no topo, overlay em
  mobile, paleta de 9 cores com troca em tempo real
- **4 temas visuais selecionáveis**: Claro, Escuro, Sépia, Apple
- **Upload de foto de perfil** com compressão Canvas (256×256 px) e reset;
  imagem salva no banco, não no JWT
- **Upload de ícone do menu lateral** com reset para o padrão
- **Filtro de período** no dashboard com 6 opções + datas personalizadas
- **Licença CC BY 4.0** adicionada ao repositório
- **README completo** com guia de instalação, configuração de OAuth,
  deploy Linux, guia do colaborador e tabela de extensão do sistema
- **`ecosystem.config.js`** para PM2
- **`.env.local.example`** como template de variáveis de ambiente
- Scripts npm: `db:generate`, `db:migrate`, `db:deploy`, `db:studio`

### Alterado
- **Banco de dados**: migrado de SQLite (libsql) para **MySQL**
  - `prisma/schema.prisma`: provider `sqlite` → `mysql`; campos grandes
    anotados com `@db.Text` / `@db.LongText`
  - `src/lib/prisma.ts`: removido adaptador libsql; PrismaClient padrão
  - `src/lib/auth.ts`: removido `DatabaseSync` do `node:sqlite`;
    autenticação de credenciais agora usa Prisma (compatível com qualquer banco)
- **`package.json`**:
  - Versão `0.1.0` → `1.0.0`
  - Removidas dependências `@libsql/client` e `@prisma/adapter-libsql`
  - Removido flag `--experimental-sqlite` do script `dev`
  - Flag `--max-http-header-size=32768` mantido em `dev` e `start`
- **Inline script no `<head>`** agora restaura também o favicon personalizado
  antes do primeiro paint
- **Texto "Bela Vista"** na sidebar: de `text-white` hardcoded para CSS var
  `--sb-text-nav` (legível em paletas claras como Cristal)
- **`theme-selector.tsx`**: tipo ampliado para incluir `"apple"`
- **`layout.tsx`**: validação de tema contra allowlist antes de aplicar

### Corrigido
- **HTTP 431 Request Header Fields Too Large** — imagem base64 de avatar não
  é mais incluída no JWT; o `dashboard/layout.tsx` busca a imagem diretamente
  do banco como Server Component
- **Hydration mismatches** em múltiplas páginas — todos os `useState(true)`
  para loading e `useState(localStorage...)` corrigidos para começar com
  valores determinísticos e carregar no `useEffect`
- **Temas não aplicando cores** — overrides de utilitários Tailwind v4
  precisam de `!important`; corrigido em `globals.css`

### Removido
- Dependência `@libsql/client`
- Dependência `@prisma/adapter-libsql`
- Flag `--experimental-sqlite` do Node.js (não mais necessário)
- Uso de `node:sqlite` / `DatabaseSync` em `auth.ts`

---

## [0.1.0] — 2026-05-01

> Versão inicial de desenvolvimento com SQLite local.

### Adicionado
- Dashboard financeiro com gráficos (Recharts)
- CRUD de transações (receitas e despesas)
- Importação de extratos CSV/OFX
- Prestação de contas mensal
- Relatórios exportáveis em PDF (jsPDF) e Excel (xlsx)
- Gestão de categorias com cores
- Autenticação local (e-mail + senha com bcrypt) e OAuth
- Controle de acesso por perfis (ADMIN, USER, OPERATOR, READ_ONLY, PENDING, REJECTED)
- Banco de dados SQLite via Prisma + adaptador libsql
- Next.js 16 App Router, TypeScript, Tailwind CSS v4

[1.0.0]: https://github.com/cristianowa1150/bela-vista-condominios/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/cristianowa1150/bela-vista-condominios/releases/tag/v0.1.0
