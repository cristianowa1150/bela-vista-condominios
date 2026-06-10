# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.1.0] — 2026-06-10

> Personalização por usuário e identidade visual controlada pelo administrador.

### Adicionado
- **Preferências visuais individuais por usuário** — tema (Claro/Escuro/
  Sépia/Apple), paleta de cores do menu e logo do menu lateral são salvos
  no banco (coluna `User.preferences`, JSON) e aplicados em qualquer
  navegador/dispositivo ao fazer login; API `GET/PUT /api/user/prefs`
- **Favicon global do sistema** — definido apenas pelo administrador e
  exibido para todos os usuários (tabela `AppSetting`); API
  `/api/settings/favicon` (leitura pública, escrita restrita a ADMIN)
- Script `upgrade-2.0.1-to-2.1.0.sql` para atualização do banco em produção

### Alterado
- Botão de alteração de favicon no cabeçalho visível somente para ADMIN
- `localStorage` rebaixado a cache de primeiro paint — a fonte da verdade
  das preferências é o banco de dados
- Usuário sem preferência salva recebe o padrão (tema Claro, paleta
  padrão) — nunca herda escolhas de outro usuário no mesmo navegador
- Pacote standalone passa a incluir a pasta `tmp/` (restart do Passenger)

---

## [2.0.1] — 2026-06-10

> Release de produção: sistema no ar em https://contas.ibia.mg.gov.br
> (cPanel/Passenger + MySQL 8). Correções descobertas durante o deploy.

### Adicionado
- **Build standalone para cPanel** — pacote pré-compilado com `node_modules`
  mínimo embutido; nenhum `npm install/build` no servidor (hospedagens
  compartilhadas com limite de memória não suportam build local)
- `prisma/schema.mysql.prisma` — schema de produção com tipos nativos
  corretos (`TEXT` para tokens OAuth, `LONGTEXT` para avatar) e geração do
  DDL `schema-mysql.sql` via `prisma migrate diff`
- `server.js`/`app.js` de inicialização para Phusion Passenger, com
  carregamento de `.env` e log da aplicação em `app.log`
- Scripts `db:mysql`/`db:sqlite` para alternar o provider do Prisma
- Guia completo `DEPLOY-CPANEL.md` (instalação, atualização, backup via
  cron com `--no-tablespaces`, solução de problemas)

### Corrigido
- **Livro-caixa compartilhado** — leituras (dashboard, transações,
  relatórios, histórico de importações) não filtram mais por usuário:
  todos os perfis aprovados veem os mesmos dados do condomínio; o autor
  de cada lançamento continua registrado para auditoria
- **MySQL 8 `caching_sha2_password`** — `allowPublicKeyRetrieval` no
  adapter mariadb (conexão local sem TLS) + pool limitado a 5 conexões

### Notas de implantação
- ModSecurity do Apache bloqueia o callback OAuth do Google (o parâmetro
  `scope` retornado contém URLs e dispara regra anti-RFI) — desativar para
  o domínio ou criar exceção para `/api/auth/callback/`
- Hospedagem compartilhada exige limites adequados (memória ≥ 512 MB,
  processos ≥ 100, arquivos abertos ≥ 1024)

---

## [2.0.0] — 2026-06-09

> Release de consolidação pré-produção: CRUD administrativo completo,
> importação multi-formato com deduplicação garantida, OAuth Google/GitHub
> configurado e auditoria de segurança/confiabilidade com suíte de testes.

### Adicionado
- **Admin CRUD completo** — criar usuário local (nome, e-mail, senha, perfil),
  editar, excluir com confirmação (mostra transações afetadas), botões rápidos
  Aprovar/Rejeitar para contas pendentes; API com POST e DELETE em
  `/api/admin/users`
- **Importação OFX, PDF e TXT** além de CSV — parser OFX (SGML/XML, Latin-1,
  saldo/período/conta), parser PDF via extração de texto com heurística
  data+valor BR, parser TXT em duas etapas (CSV delimitado → texto livre)
- **Deduplicação de importação em duas camadas** — hash SHA-256 do arquivo
  bloqueia reimportação do mesmo extrato; dedupe transação a transação
  (data + tipo + valor + descrição normalizada) com controle de multiplicidade,
  permitindo complementar mês em aberto com extratos parciais (5/15/30 dias)
  sem jamais duplicar lançamentos; notificações na tela explicando o motivo
  de qualquer bloqueio
- **Relatórios paginados** — tabela "Todas as Transações do Período" com
  25–300 registros por página; exportação PDF imprime 100% dos registros
  com totalizador, independente da paginação em tela
- **Autorização por perfil em todas as APIs** (`src/lib/authz.ts`) — matriz
  ADMIN/USER/OPERATOR/READ_ONLY aplicada endpoint a endpoint (defesa em
  profundidade além do proxy)
- **Suíte de testes de unidade** (`npm test`, 39 casos) — matemática monetária,
  parseAmount, parser OFX, parser texto livre e deduplicação
- **OAuth Google e GitHub** configurados para `contas.ibia.mg.gov.br` e
  desenvolvimento local

### Alterado
- **Login simplificado** — provedores OAuth reduzidos a Google e GitHub
- Totais da prestação de contas arredondados a 2 casas (`round2`) em todas
  as gravações e respostas de API
- Coluna `fileHash` adicionada a `ImportHistory` (migração)

### Removido
- **BREAKING:** provedor OAuth Microsoft/Azure AD (variáveis `AZURE_AD_*`
  não são mais lidas)
- **Segurança:** rota `/api/diag` (expunha e-mails/perfis sem autenticação
  e dependia de `node:sqlite` removido)

### Corrigido
- Usuário Somente Leitura conseguia criar/editar/excluir transações e
  importar extratos via chamadas diretas à API
- `/api/seed` restrito a administradores
- Cliente Prisma gerado continha resquícios de geração antiga (provider
  `prisma-client`), causando 404 em todas as rotas de API em dev

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
