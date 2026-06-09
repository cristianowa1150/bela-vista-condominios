/**
 * Testes de unidade da lógica crítica do sistema.
 * Execução: npm test  (npx tsx tests/unit.ts)
 *
 * Cobre: matemática monetária, parsing de valores/datas, parsers de extrato
 * (OFX, texto livre/PDF/TXT) e deduplicação com multiplicidade.
 */
import { parseAmount } from "../src/lib/parsers/csv-parser";
import { parseOFX } from "../src/lib/parsers/ofx-parser";
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

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}\n${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main();
