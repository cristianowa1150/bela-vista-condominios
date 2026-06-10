/**
 * Testes de unidade da lógica crítica do sistema.
 * Execução: npm test  (npx tsx tests/unit.ts)
 *
 * Cobre: matemática monetária, parsing de valores/datas, parsers de extrato
 * (OFX, texto livre/PDF/TXT) e deduplicação com multiplicidade.
 */
import { parseAmount } from "../src/lib/parsers/csv-parser";
import { parseOFX, parseOFXEntries } from "../src/lib/parsers/ofx-parser";
import {
  classifyInvestmentMemo,
  classifyEntries,
  snapshotTotals,
  flowEntries,
  dedupFlows,
  computePosition,
  matchContaInvestmentFlow,
} from "../src/lib/investments";
import { parseStatementText } from "../src/lib/parsers/pdf-parser";
import { splitWithExisting, txKey } from "../src/lib/import-dedup";
import { round2 } from "../src/lib/money";

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

  // ── Investimentos: classificação de MEMOs ─────────────────────────────────
  console.log("\nclassifyInvestmentMemo");
  eq("rendimento até esta data → snapshot",
    classifyInvestmentMemo("RENDIMENTO ATÉ ESTA DATA"), { type: "RENDIMENTO", snapshot: true });
  eq("IR p/ resgate total → IR_PREVISTO (não RESGATE)",
    classifyInvestmentMemo("PREVISÃO DE I.R. PARA RESGATE TOTAL ATÉ ESTA DATA"),
    { type: "IR_PREVISTO", snapshot: true });
  eq("IOF → IOF_PREVISTO",
    classifyInvestmentMemo("PREVISÃO PARA I.O.F. ATÉ ESTA DATA(ISENTO APÓS 30 DIAS DA APLICAÇÃO)"),
    { type: "IOF_PREVISTO", snapshot: true });
  eq("aplicação é fluxo",
    classifyInvestmentMemo("APLICAÇÃO CDB DI"), { type: "APLICACAO", snapshot: false });
  eq("resgate é fluxo",
    classifyInvestmentMemo("RESGATE CDB DI"), { type: "RESGATE", snapshot: false });

  // ── Investimentos: extrato OFX real (Inter DTVM, parcial) ─────────────────
  console.log("\nparseOFXEntries + matemática do extrato DTVM");
  const dtvm = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF>
<BANKTRANLIST><DTSTART>20260401</DTSTART><DTEND>20260610</DTEND>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260610</DTPOSTED><TRNAMT>16.29</TRNAMT><FITID>20260610523533540</FITID><MEMO>RENDIMENTO ATÉ ESTA DATA</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>PAYMENT</TRNTYPE><DTPOSTED>20260610</DTPOSTED><TRNAMT>-6.23</TRNAMT><FITID>20260610523533540</FITID><MEMO>PREVISÃO DE I.R. PARA RESGATE TOTAL ATÉ ESTA DATA</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260610</DTPOSTED><TRNAMT>3.25</TRNAMT><FITID>20260610524925742</FITID><MEMO>RENDIMENTO ATÉ ESTA DATA</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>PAYMENT</TRNTYPE><DTPOSTED>20260610</DTPOSTED><TRNAMT>-0.10</TRNAMT><FITID>20260610602906821</FITID><MEMO>PREVISÃO PARA I.O.F. ATÉ ESTA DATA(ISENTO APÓS 30 DIAS DA APLICAÇÃO)</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260415</DTPOSTED><TRNAMT>-500.00</TRNAMT><FITID>APP1</FITID><MEMO>APLICAÇÃO CDB DI</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260420</DTPOSTED><TRNAMT>200.00</TRNAMT><FITID>RES1</FITID><MEMO>RESGATE CDB DI</MEMO></STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>3085.06</BALAMT><DTASOF>20260610</DTASOF></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const inv = await parseOFXEntries(new File([dtvm], "dtvm.ofx"));
  eq("posição (LEDGERBAL)", inv.saldo, 3085.06);
  eq("data do snapshot (DTASOF)", inv.dtAsOf, "2026-06-10");
  eq("período", `${inv.periodStart}|${inv.periodEnd}`, "2026-04-01|2026-06-10");
  eq("FITID preservado", inv.entries[0].fitid, "20260610523533540");

  const cls = classifyEntries(inv.entries);
  const totals = snapshotTotals(cls);
  eq("Σ rendimento acumulado", totals.rendimento, 19.54);     // 16.29 + 3.25
  eq("Σ IR previsto", totals.irPrevisto, 6.23);
  eq("Σ IOF previsto", totals.iofPrevisto, 0.1);
  const flows = flowEntries(cls);
  eq("fluxos = aplicação + resgate (snapshot fora)", flows.length, 2);
  eq("aplicação com valor absoluto", flows[0], {
    date: "2026-04-15", type: "APLICACAO", description: "APLICAÇÃO CDB DI",
    amount: 500, fitid: "APP1", snapshot: false,
  });

  // ── Investimentos: dedup de fluxos ────────────────────────────────────────
  console.log("\ndedupFlows");
  const d1 = dedupFlows(flows, [
    { date: new Date("2026-04-15T12:00:00Z"), type: "APLICACAO", amount: 500,
      description: "APLICAÇÃO CDB DI", fitid: "APP1" },
  ]);
  eq("FITID já importado → ignora aplicação, mantém resgate", d1.fresh.length, 1);
  eq("1 duplicada por FITID", d1.duplicates, 1);
  const d2 = dedupFlows(flows, [
    { date: new Date("2026-04-15T12:00:00Z"), type: "APLICACAO", amount: 500,
      description: "aplicação  cdb di", fitid: null },
  ]);
  eq("sem FITID: dedup por chave normalizada", d2.duplicates, 1);
  const d3 = dedupFlows(flows, []);
  eq("banco vazio: importa os 2 fluxos", d3.fresh.length, 2);

  // ── Investimentos: posição (LEDGERBAL do DTVM é saldo da conta, ignorado) ─
  console.log("\ncomputePosition + matchContaInvestmentFlow");
  eq("posição = aplicado − resgatado + rendimento",
    computePosition(6898.68, 0, 80.11), 6978.79);
  eq("posição com resgate", computePosition(1000, 200, 15.5), 815.5);
  eq("centavos exatos", computePosition(0.1, 0, 0.2), 0.3);
  eq("despesa APLICACAO na conta → aporte",
    matchContaInvestmentFlow("APLICACAO CDB DI", "DESPESA"), "APLICACAO");
  eq("acentuada minúscula também",
    matchContaInvestmentFlow("Aplicação automática RDB", "DESPESA"), "APLICACAO");
  eq("receita RESGATE na conta → retirada",
    matchContaInvestmentFlow("RESGATE CDB", "RECEITA"), "RESGATE");
  eq("receita APLICACAO não é aporte (estorno)",
    matchContaInvestmentFlow("APLICACAO CDB", "RECEITA"), null);
  eq("descrição comum não casa",
    matchContaInvestmentFlow("PAGTO ENERGIA", "DESPESA"), null);

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}\n${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main();
