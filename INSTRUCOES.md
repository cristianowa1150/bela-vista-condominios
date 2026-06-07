# Condomínio Bela Vista — Sistema Financeiro

## Como usar

### 1. Configurar as credenciais OAuth

Edite o arquivo `.env.local` com as credenciais dos provedores:

#### Google OAuth
1. Acesse https://console.cloud.google.com/apis/credentials
2. Crie um projeto → Credenciais → OAuth 2.0
3. URI de redirecionamento autorizado: `http://localhost:3000/api/auth/callback/google`
4. Copie `Client ID` → `GOOGLE_CLIENT_ID` e `Client Secret` → `GOOGLE_CLIENT_SECRET`

#### GitHub OAuth
1. Acesse https://github.com/settings/developers → New OAuth App
2. Homepage URL: `http://localhost:3000`
3. Callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copie as credenciais para `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`

#### Microsoft Azure AD
1. Acesse https://portal.azure.com → Azure Active Directory → Registros de aplicativo
2. Novo registro → URI de redirecionamento: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. Copie as credenciais para `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` e `AZURE_AD_TENANT_ID`

#### AUTH_SECRET
Gere uma chave segura com:
```
openssl rand -base64 32
```
Ou use qualquer string longa aleatória.

### 2. Iniciar o sistema

Dê duplo clique em `iniciar.bat` ou execute no terminal:
```
npm run dev
```

Acesse: http://localhost:3000

### 3. Primeiro acesso

1. Faça login com Google, GitHub ou Microsoft
2. Vá em **Categorias** para criar as categorias do condomínio
3. Adicione transações manualmente ou **Importe** extratos bancários

### 4. Importar Extratos

O sistema aceita arquivos **CSV** e **XLSX** exportados do Internet Banking.

O arquivo deve conter colunas como:
- **Data** (DD/MM/YYYY ou YYYY-MM-DD)
- **Descrição / Histórico** 
- **Valor** (positivo = receita, negativo = despesa)

### Funcionalidades

| Página | Descrição |
|--------|-----------|
| Dashboard | Gráficos resumo do mês e histórico 12 meses |
| Transações | CRUD completo com filtros e paginação |
| Importar | Upload CSV/XLSX com prévia antes de confirmar |
| Relatórios | Análise por período com exportação Excel |
| Categorias | Gestão de categorias de receitas e despesas |

### Tecnologias

- **Next.js 16** + TypeScript
- **Auth.js v5** (OAuth Google, GitHub, Microsoft)
- **Prisma 7** + SQLite (banco local)
- **Recharts** — gráficos interativos
- **Tailwind CSS** — interface responsiva
- **papaparse + xlsx** — parser de arquivos
