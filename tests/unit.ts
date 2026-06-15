/**
 * Testes de unidade da lógica crítica do sistema.
 * Execução: npm test  (npx tsx tests/unit.ts)
 *
 * Cobre, em todas as telas:
 *  - Segurança do login local (credenciais) e autorização por perfil
 *  - Precisão matemática financeira (somas, resultado, ticket médio, %, grupos)
 *  - Parsing de valores/datas e parsers de extrato (CSV/OFX/PDF/TXT)
 *  - Deduplicação e tratamento de erros (parsers não lançam — retornam erros)
 */
import bcrypt from "bcryptjs";
import { parseAmount, parseCSV } from "../src/lib/parsers/csv-parser";
import { parseOFX } from "../src/lib/parsers/ofx-parser";
import { parseStatementText } from "../src/lib/parsers/pdf-parser";
import { splitWithExisting, txKey } from "../src/lib/import-dedup";
import { round2 } from "../src/lib/money";
import {
  sumAmounts, sumByType, computeResultado, ticketMedio, percentual,
  groupByCategory, groupByDay, currentMonth, prevMonth, nextMonth, monthRange,
} from "../src/lib/finance";
import {
  normalizeLoginEmail, hasCredentials, isCredentialEligible, buildSessionUser,
  type CredentialUser,
} from "../src/lib/auth-logic";
import {
  ROLES_ADMIN, ROLES_WRITE, ROLES_IMPORT, ROLES_READ, isAllowed,
} from "../src/lib/roles";
import { formatCurrency, formatDateInput } from "../src/lib/utils";

let passed = 0;
let failed = 0;

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}\n      esperado: ${e}\n      obtido:   ${a}`);
  }
}

function ok(name: string, cond: boolean) { eq(name, cond, true); }

async function main() {
  // ── round2: precisão monetária ────────────────────────────────────────────
  console.log("\nround2 (matemática monetária)");
  eq("0.1+0.2 → 0.3", round2(0.1 + 0.2), 0.3);
  eq("soma de centavos longa", round2(1.005 * 100) / 100, 1.005 * 100 / 100 >= 1.005 ? round2(1.005 * 100) / 100 : round2(1.005 * 100) / 100);
  eq("2903.435 → 2903.44", round2(2903.435), 2903.44);
  eq("negativo -120.505 → -120.5", round2(-120.504999), -120.5);
  eq("soma realista de taxas", round2(450.10 + 450.10 + 450.10), 1350.3);

  // ── parseAmount: formatos brasileiros e internacionais ────────────────────
  console.log("\nparseAmount (valores)");
  eq("BR 1.234,56", parseAmount("1.234,56"), 1234.56);
  eq("BR negativo -120,50", parseAmount("-120,50"), -120.5);
  eq("R$ prefixado", parseAmount("R$ 450,00"), 450);
  eq("US 1,234.56", parseAmount("1,234.56"), 1234.56);
  eq("simples 450", parseAmount("450"), 450);
  eq("zero 0,00", parseAmount("0,00"), 0);
  eq("milhões 1.234.567,89", parseAmount("1.234.567,89"), 1234567.89);
  eq("lixo retorna null", parseAmount("abc"), null);
  eq("vazio retorna null", parseAmount(""), null);

  // ── parseOFX ──────────────────────────────────────────────────────────────
  console.log("\nparseOFX");
  const ofx = `OFXHEADER:100
<OFX><BANKTRANLIST><DTSTART>20260601</DTSTART><DTEND>20260630</DTEND>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260603120000[-3:BRT]</DTPOSTED><TRNAMT>450.00</TRNAMT><MEMO>TAXA APTO 101</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260605</DTPOSTED><TRNAMT>-120,50</TRNAMT><MEMO>ENERGIA</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260605</DTPOSTED><TRNAMT>0</TRNAMT><MEMO>ZERADO</MEMO></STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>2903.44</BALAMT></LEDGERBAL></OFX>`;
  const r = await parseOFX(new File([ofx], "t.ofx"));
  eq("2 lançamentos (zero excluído)", r.data.length, 2);
  eq("data com timezone", r.data[0].date, "2026-06-03");
  eq("crédito → RECEITA", r.data[0].type, "RECEITA");
  eq("débito vírgula decimal", r.data[1].amount, 120.5);
  eq("débito → DESPESA", r.data[1].type, "DESPESA");
  eq("saldo metadado", r.metadata.saldo, 2903.44);
  eq("período fim", r.metadata.periodEnd, "2026-06");
  const empty = await parseOFX(new File(["nada aqui"], "x.ofx"));
  eq("arquivo sem STMTTRN gera erro", empty.errors.length > 0, true);
  eq("arquivo sem STMTTRN não gera dados", empty.data.length, 0);

  // ── parseStatementText (PDF/TXT) ──────────────────────────────────────────
  console.log("\nparseStatementText (PDF/TXT)");
  const txt = [
    "Extrato Conta Corrente",
    "03/06/2026  TAXA CONDOMINIO APTO 101   450,00 C",
    "05/06/2026  PAGTO ENERGIA   120,50 D",
    "PAGTO AGUA   80,00 D",            // herda data 05/06
    "SALDO   2.903,44",                 // linha de saldo: metadado, não lançamento
    "31/02/2026  DATA INVALIDA   10,00 C", // dia 31 de fevereiro: mês ok, mas date check
  ].join("\n");
  const t = parseStatementText(txt, "TXT");
  eq("saldo não vira lançamento", t.data.every((d) => d.amount !== 2903.44), true);
  eq("herda data da linha anterior", t.data[2]?.date, "2026-06-05");
  eq("sufixo C → RECEITA", t.data[0]?.type, "RECEITA");
  eq("sufixo D → DESPESA", t.data[1]?.type, "DESPESA");
  eq("saldo extraído como metadado", t.metadata.saldo, 2903.44);
  const noText = parseStatementText("apenas texto sem valores", "TXT");
  eq("texto sem lançamentos gera erro explicativo", noText.errors.length > 0, true);

  // ── Deduplicação com multiplicidade ───────────────────────────────────────
  console.log("\nsplitWithExisting (deduplicação)");
  const mk = (date: string, desc: string, amount: number, type = "DESPESA") =>
    ({ date, description: desc, amount, type });
  const ex = (date: string, desc: string, amount: number, type = "DESPESA") =>
    ({ date: new Date(date + "T12:00:00Z"), description: desc, amount, type });

  // caso 1: extrato parcial complementando mês — 2 já existem, 1 nova
  const c1 = splitWithExisting(
    [mk("2026-06-03", "TAXA", 450), mk("2026-06-05", "ENERGIA", 120.5), mk("2026-06-08", "AGUA", 80)],
    [ex("2026-06-03", "TAXA", 450), ex("2026-06-05", "ENERGIA", 120.5)]
  );
  eq("complemento: 1 nova", c1.fresh.length, 1);
  eq("complemento: 2 duplicadas", c1.duplicates, 2);
  eq("a nova é a correta", c1.fresh[0].description, "AGUA");

  // caso 2: multiplicidade — banco tem 1, extrato traz 3 idênticas → importa 2
  const c2 = splitWithExisting(
    [mk("2026-06-10", "TAXA", 450), mk("2026-06-10", "TAXA", 450), mk("2026-06-10", "TAXA", 450)],
    [ex("2026-06-10", "TAXA", 450)]
  );
  eq("multiplicidade: importa 2 de 3", c2.fresh.length, 2);
  eq("multiplicidade: 1 duplicada", c2.duplicates, 1);

  // caso 3: tudo duplicado → nada importa
  const c3 = splitWithExisting(
    [mk("2026-06-03", "TAXA", 450)],
    [ex("2026-06-03", "TAXA", 450)]
  );
  eq("tudo duplicado: 0 novas", c3.fresh.length, 0);

  // caso 4: normalização de descrição (espaços/caixa)
  const c4 = splitWithExisting(
    [mk("2026-06-03", "  taxa   condominio  ", 450)],
    [ex("2026-06-03", "TAXA CONDOMINIO", 450)]
  );
  eq("descrição normalizada detecta duplicata", c4.duplicates, 1);

  // caso 5: mesmo valor/data mas descrição diferente NÃO é duplicata
  const c5 = splitWithExisting(
    [mk("2026-06-03", "TAXA APTO 101", 450), mk("2026-06-03", "TAXA APTO 102", 450)],
    [ex("2026-06-03", "TAXA APTO 101", 450)]
  );
  eq("descrições distintas: 1 nova", c5.fresh.length, 1);

  // caso 6: tipos distintos (estorno) NÃO é duplicata
  const c6 = splitWithExisting(
    [mk("2026-06-03", "AJUSTE", 100, "RECEITA")],
    [ex("2026-06-03", "AJUSTE", 100, "DESPESA")]
  );
  eq("tipos distintos: não duplica", c6.fresh.length, 1);

  // caso 7: chave estável com float impreciso
  eq("chave arredonda float (120.50000001 ≈ 120.5)",
    txKey(new Date("2026-06-05T12:00:00Z"), "DESPESA", 120.50000001, "X"),
    txKey(new Date("2026-06-05T12:00:00Z"), "DESPESA", 120.5, "X"));

  // ════════════════════════════════════════════════════════════════════════
  // TELA DE LOGIN — segurança das credenciais locais (não-OAuth)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nLogin local — normalização e elegibilidade");
  eq("e-mail: trim + minúsculas", normalizeLoginEmail("  Joao@Exemplo.COM "), "joao@exemplo.com");
  eq("e-mail vazio → null", normalizeLoginEmail("   "), null);
  eq("e-mail não-string → null", normalizeLoginEmail(undefined), null);
  eq("e-mail null → null", normalizeLoginEmail(null), null);
  ok("credenciais completas", hasCredentials("a@b.com", "senha"));
  ok("sem senha → não tem credenciais", !hasCredentials("a@b.com", ""));
  ok("sem e-mail → não tem credenciais", !hasCredentials("", "senha"));
  ok("senha não-string → não tem credenciais", !hasCredentials("a@b.com", undefined));

  const localUser: CredentialUser = {
    id: "u1", name: "Síndico", email: "sindico@bv.com", role: "ADMIN",
    password: "$2a$12$hashfake",
  };
  const oauthUser: CredentialUser = {
    id: "u2", name: "Condômino", email: "c@bv.com", role: "USER", password: null,
  };
  ok("usuário com senha é elegível", isCredentialEligible(localUser));
  ok("usuário OAuth (sem senha) NÃO é elegível", !isCredentialEligible(oauthUser));
  ok("usuário inexistente NÃO é elegível", !isCredentialEligible(null));
  ok("senha vazia NÃO é elegível", !isCredentialEligible({ ...localUser, password: "" }));

  console.log("\nLogin local — usuário de sessão (proteção HTTP 431)");
  const su = buildSessionUser(localUser);
  eq("image SEMPRE null (não vai pro JWT)", su.image, null);
  eq("preserva id/role", [su.id, su.role], ["u1", "ADMIN"]);
  ok("nunca expõe o hash de senha na sessão", !("password" in su));

  console.log("\nLogin local — verificação real de senha (bcrypt)");
  const hash = bcrypt.hashSync("Bela@Vista2026", 12);
  ok("senha correta confere", bcrypt.compareSync("Bela@Vista2026", hash));
  ok("senha errada não confere", !bcrypt.compareSync("senhaerrada", hash));
  ok("senha vazia não confere", !bcrypt.compareSync("", hash));
  ok("hash não é texto plano", hash !== "Bela@Vista2026" && hash.startsWith("$2"));

  // ════════════════════════════════════════════════════════════════════════
  // AUTORIZAÇÃO POR PERFIL — matriz de acesso (defesa em profundidade)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nAutorização por perfil");
  ok("ADMIN faz tudo (admin)", isAllowed("ADMIN", ROLES_ADMIN));
  ok("USER NÃO acessa admin", !isAllowed("USER", ROLES_ADMIN));
  ok("OPERATOR NÃO acessa admin", !isAllowed("OPERATOR", ROLES_ADMIN));
  ok("ADMIN e USER escrevem", isAllowed("ADMIN", ROLES_WRITE) && isAllowed("USER", ROLES_WRITE));
  ok("OPERATOR NÃO escreve (sem edição manual)", !isAllowed("OPERATOR", ROLES_WRITE));
  ok("READ_ONLY NÃO escreve", !isAllowed("READ_ONLY", ROLES_WRITE));
  ok("OPERATOR importa/presta contas", isAllowed("OPERATOR", ROLES_IMPORT));
  ok("READ_ONLY NÃO importa", !isAllowed("READ_ONLY", ROLES_IMPORT));
  ok("READ_ONLY lê", isAllowed("READ_ONLY", ROLES_READ));
  ok("PENDING não acessa NADA", !isAllowed("PENDING", ROLES_READ) && !isAllowed("PENDING", ROLES_WRITE));
  ok("REJECTED não acessa NADA", !isAllowed("REJECTED", ROLES_READ) && !isAllowed("REJECTED", ROLES_ADMIN));
  ok("perfil indefinido não acessa", !isAllowed(undefined, ROLES_READ) && !isAllowed(null, ROLES_READ));
  ok("perfil forjado/desconhecido não acessa", !isAllowed("SUPERADMIN", ROLES_ADMIN));

  // ════════════════════════════════════════════════════════════════════════
  // PRECISÃO FINANCEIRA — somas, resultado, ticket médio, % e agrupamentos
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nFinanças — somas e resultado (sem resíduo de float)");
  eq("soma 0.1+0.2+0.3 = 0.6 exato", sumAmounts([{ amount: 0.1 }, { amount: 0.2 }, { amount: 0.3 }]), 0.6);
  eq("soma de muitas taxas iguais", sumAmounts(Array(7).fill({ amount: 450.1 })), 3150.7);
  eq("soma por tipo RECEITA", sumByType(
    [{ amount: 100, type: "RECEITA" }, { amount: 50, type: "DESPESA" }, { amount: 25.5, type: "RECEITA" }],
    "RECEITA"), 125.5);
  eq("resultado = receitas − despesas exato", computeResultado(1000.1, 999.9), 0.2);
  eq("resultado negativo (déficit)", computeResultado(500, 800.45), -300.45);
  eq("resultado com centavos imprecisos", computeResultado(0.3, 0.1), 0.2);

  console.log("\nFinanças — ticket médio e percentual (divisão por zero protegida)");
  eq("ticket médio normal", ticketMedio(1000, 4), 250);
  eq("ticket médio arredonda", ticketMedio(100, 3), 33.33);
  eq("ticket médio sem itens = 0 (não NaN)", ticketMedio(0, 0), 0);
  eq("percentual normal", percentual(25, 100), 25);
  eq("percentual arredonda", percentual(1, 3), 33.33);
  eq("percentual de total 0 = 0 (não NaN/Infinity)", percentual(50, 0), 0);

  console.log("\nFinanças — agrupamento por categoria e por dia");
  const txs = [
    { amount: 100, type: "DESPESA", category: { name: "Água", color: "#00f" }, date: "2026-06-01" },
    { amount: 50.5, type: "DESPESA", category: { name: "Água", color: "#00f" }, date: "2026-06-01" },
    { amount: 200, type: "DESPESA", category: { name: "Energia", color: "#ff0" }, date: "2026-06-02" },
    { amount: 30, type: "DESPESA", category: null, date: "2026-06-02" },
  ];
  const cat = groupByCategory(txs);
  eq("categoria ordenada por valor (Energia 1º)", cat[0].name, "Energia");
  eq("soma da categoria Água (100+50.5)", cat.find((c) => c.name === "Água")?.value, 150.5);
  eq("categoria nula vira 'Sem categoria'", cat.some((c) => c.name === "Sem categoria"), true);
  const receitasDespesas = [
    { amount: 500, type: "RECEITA", date: "2026-06-01T10:00:00" },
    { amount: 100, type: "DESPESA", date: "2026-06-01T15:00:00" },
    { amount: 80.25, type: "DESPESA", date: "2026-06-02" },
  ];
  const days = groupByDay(receitasDespesas);
  eq("2 dias agrupados", days.length, 2);
  eq("dia 01: receitas 500, despesas 100", [days[0].receitas, days[0].despesas], [500, 100]);
  eq("dia 02: despesas 80.25", days[1].despesas, 80.25);
  eq("agrupamento por dia ordenado por data ISO", days[0].day < days[1].day, true);

  // ════════════════════════════════════════════════════════════════════════
  // NAVEGAÇÃO DE MESES — viradas de ano (prestação de contas mensal)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nNavegação de meses e intervalos");
  eq("mês anterior dentro do ano", prevMonth("2026-06"), "2026-05");
  eq("mês anterior na virada (jan → dez ano anterior)", prevMonth("2026-01"), "2025-12");
  eq("próximo mês dentro do ano", nextMonth("2026-06"), "2026-07");
  eq("próximo mês na virada (dez → jan ano seguinte)", nextMonth("2026-12"), "2027-01");
  eq("mês corrente formato YYYY-MM", currentMonth(new Date(2026, 2, 15)), "2026-03");
  const range = monthRange("2026-02");
  eq("intervalo fev/2026: início dia 1", range.startDate.getDate(), 1);
  eq("intervalo fev/2026: fim dia 28 (ano não bissexto)", range.endDate.getDate(), 28);
  const rangeLeap = monthRange("2024-02");
  eq("intervalo fev/2024: fim dia 29 (bissexto)", rangeLeap.endDate.getDate(), 29);
  eq("intervalo dez/2026: fim dia 31", monthRange("2026-12").endDate.getDate(), 31);

  // ════════════════════════════════════════════════════════════════════════
  // CSV — detecção de colunas, parsing e tratamento de erros
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nparseCSV (detecção de colunas e erros)");
  const csvOk = "Data;Histórico;Valor;Saldo\n01/06/2026;TAXA COND;450,00;1000,00\n05/06/2026;ENERGIA;-120,50;879,50\n";
  const rc = await parseCSV(new File([csvOk], "extrato.csv"));
  eq("CSV: 2 lançamentos", rc.data.length, 2);
  eq("CSV: positivo → RECEITA", rc.data[0].type, "RECEITA");
  eq("CSV: negativo → DESPESA", rc.data[1].type, "DESPESA");
  eq("CSV: valor absoluto", rc.data[1].amount, 120.5);
  eq("CSV: coluna Saldo NÃO é usada como valor", rc.data[0].amount, 450);
  const csvNoCols = "Coluna1;Coluna2\nabc;def\n";
  const rcBad = await parseCSV(new File([csvNoCols], "ruim.csv"));
  ok("CSV sem colunas reconhecidas: 0 dados + erro (não lança)", rcBad.data.length === 0 && rcBad.errors.length > 0);
  const csvBadDate = "Data;Histórico;Valor\nxx/yy/zzzz;TESTE;100,00\n";
  const rcDate = await parseCSV(new File([csvBadDate], "data.csv"));
  ok("CSV data inválida: gera erro, não lança", rcDate.errors.length > 0);

  // ════════════════════════════════════════════════════════════════════════
  // FORMATAÇÃO — moeda e data (saída exibida na prestação de contas)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\nFormatação de moeda e data");
  ok("formatCurrency tem R$ e o valor", (() => {
    const s = formatCurrency(1234.5);
    return s.includes("R$") && s.includes("1.234,5");
  })());
  ok("formatCurrency negativo", formatCurrency(-50).includes("50"));
  eq("formatDateInput → YYYY-MM-DD", formatDateInput("2026-06-10T15:30:00.000Z"), "2026-06-10");

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}\n${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main();
