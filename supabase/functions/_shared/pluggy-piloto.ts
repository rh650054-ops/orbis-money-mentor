// Vant — PILOTO AUTOMÁTICO (etapa 3 do Open Finance, 02/10/2026).
// A cada leitura do banco (pluggy-hora), além do Pix que vai pro ranking:
//   • grava o SALDO de cada conta BANK em bank_saldos ("quanto você tem agora");
//   • joga cada movimentação (saída e entrada) no Raio-X (extrato_lancamentos,
//     origem 'pluggy'), já com categoria. Mesma régua do extrato em PDF:
//     dicionário de comerciantes primeiro, depois a categoria que a Pluggy manda,
//     e a inteligência do banco (extrato_analisar_padroes) fecha o resto.
// Nunca grava número de conta/agência/CPF: a descrição passa por limpaNumeros.
// Se o vendedor já mandou PDF desse banco no mês, o mês fica com o PDF (não duplica).

import { quandoFoi, mesmoDono, diaBRT } from "./pluggy-entradas.ts";

const limpaNumeros = (s: string) =>
  s.replace(/\d[\d.\-\/]{3,}\d/g, "").replace(/\d{5,}/g, "").replace(/\s+/g, " ").trim();

/** Mesma normalização do extrato_norm() no banco. */
export function norm(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]+/g, " ").replace(/[^A-Z ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Cópia do dicionário do extrato-analisar (marcas inequívocas ganham de tudo).
const DIC_SAIDA: Array<[RegExp, string]> = [
  [/\bUBER\s*EATS\b/, "delivery"],
  [/\b(IFOOD|IFD|RAPPI|ZE\s*DELIVERY|AIQFOME|DAKI)\b/, "delivery"],
  [/\b(UBER|99\s?(POP|APP|TAXI|MOTO)?|INDRIVE|IN\s*DRIVE|CABIFY)\b/, "transporte_app"],
  [/\b(NETFLIX|SPOTIFY|AMAZON\s*PRIME|PRIME\s*VIDEO|DISNEY|HBO|GLOBOPLAY|YOUTUBE|DEEZER|PARAMOUNT|CRUNCHYROLL|ICLOUD|APPLE\s*COM|GOOGLE\s*(PLAY|ONE|STORAGE)|CANVA|TELECINE)\b/, "assinaturas"],
  [/\b(CLARO|VIVO|TIM\s*S\s*A|TIM\s*CELULAR|OI\s*MOVEL|RECARGA\s*(CELULAR|TIM|CLARO|VIVO)|ALGAR|NEXTEL)\b/, "celular_internet"],
  [/\b(ENEL|LIGHT\s*S|CEMIG|CPFL|COPEL|COELBA|CELPE|EQUATORIAL|NEOENERGIA|SABESP|CEDAE|COMGAS|NATURGY|EMBASA|COMPESA|CAGECE|IPTU|CONDOMINIO)\b/, "contas_casa"],
  [/\b(DROGA\w*|FARMA\w*|PAGUE\s*MENOS|RAIA|DROGASIL|ULTRAFARMA|PANVEL|NISSEI)\b/, "farmacia"],
  [/\b(SHELL|IPIRANGA|PETROBRAS|POSTO|AUTO\s*POSTO|BR\s*MANIA)\b/, "combustivel"],
  [/\b(RIOCARD|BILHETE\s*UNICO|SPTRANS|METRO\w*|CPTM|SUPERVIA|VLT|BRT|JAE\b|TOP\s*RJ|CARTAO\s*TOP|BOM\s*TRANSPORTE|SEM\s*PARAR|CONECTCAR)\b/, "onibus"],
  [/\b(BETANO|BET\s*365|BET365|BLAZE|ESPORTES?\s*DA\s*SORTE|SPORTINGBET|PIXBET|BETNACIONAL|ESTRELA\s*BET|SUPERBET|NOVIBET|BETFAIR|LOTERIA|LOTERICA|MEGA\s*SENA|CASA\s*DE\s*APOSTAS|BET)\b/, "apostas"],
  [/\b(SAQUE|RETIRADA|BANCO\s*24|CAIXA\s*24|TECBAN)\b/, "saque"],
  [/\b(TARIFA|IOF|ANUIDADE|JUROS|MULTA|ENCARGO)\b/, "taxas"],
  [/\b(SHOPEE|SHEIN|RENNER|RIACHUELO|CENTAURO|NETSHOES|MARISA|PERNAMBUCANAS|KALUNGA)\b/, "roupas"],
  [/\b(MC\s*DONALD\w*|MCDONALDS|BURGER\s*KING|SUBWAY|HABIB\w*|GIRAFFAS|PIZZARIA|LANCHONETE|RESTAURANTE|CHURRASCARIA|SPOLETO|OUTBACK|STARBUCKS|CACAU\s*SHOW|KOPENHAGEN)\b/, "restaurante"],
  [/\b(STEAM|PLAYSTATION|XBOX|NINTENDO|RIOT|GARENA|FREE\s*FIRE|CINEMARK|CINEPOLIS|KINOPLEX|INGRESSO\w*|SYMPLA|EVENTIM)\b/, "lazer"],
  [/\b(PAGAMENTO\s*(DE\s*)?FATURA|PGTO\s*FATURA|FATURA\s*CARTAO|FATURA|PICPAY\s*CARD)\b/, "fatura_cartao"],
  [/\b(RECEITA\s*FED\w*|SIMPLES\s*NACIONAL|DARF|PGMEI|DAS\s*MEI)\b/, "impostos"],
  [/\b(EMPRESTIMO|FINANCIAMENTO|CREDIARIO|CONSIGNADO|CREDITO\s*PESSOAL|PARCELA)\b/, "parcelas"],
  [/\b(APLICACAO|RESGATE|POUPANCA|CAIXINHA|COFRINHO|RDB|CDB|TESOURO|INVESTIMENTO)\b/, "transferencia_propria"],
];
const DIC_ENTRADA: Array<[RegExp, string]> = [
  [/\b(STONE|PAGSEGURO|PAG\s*SEGURO|MERCADO\s*PAGO|MERCADOPAGO|CIELO|GETNET|SUMUP|SUM\s*UP|INFINITE\s*PAY|INFINITEPAY|PAGBANK|SAFRAPAY)\b/, "cartao_recebido"],
  [/\b(ESTORNO|DEVOLUCAO|REEMBOLSO|CASHBACK)\b/, "estorno"],
  [/\b(PIX\s*RECEBIDO|RECEBIMENTO\s*PIX|TRANSF\w*\s*RECEBIDA\s*PIX|PIX\s*CRED)\b/, "pix_recebido"],
  [/\b(TED|DOC\b|TRANSF\w*\s*RECEBIDA)\b/, "transferencia_recebida"],
];

// Categoria da própria Pluggy (em inglês) → categoria do Raio-X.
const PLUGGY_SAIDA: Array<[RegExp, string]> = [
  [/same person|own account|investment|savings|automatic investment/i, "transferencia_propria"],
  [/credit card payment/i, "fatura_cartao"],
  [/food delivery|delivery/i, "delivery"],
  [/groceries|supermarket/i, "mercado"],
  [/restaurant|food and drinks|eating out|bars|coffee/i, "restaurante"],
  [/taxi|ride.?hailing|transport app/i, "transporte_app"],
  [/gas station|fuel/i, "combustivel"],
  [/public transport|bus|subway|toll/i, "onibus"],
  [/pharmac|drugstore/i, "farmacia"],
  [/telecom|internet|mobile|phone/i, "celular_internet"],
  [/electricity|water|utilities|rent|housing|condominium/i, "contas_casa"],
  [/streaming|subscription|digital services|software/i, "assinaturas"],
  [/clothing|apparel|shopping/i, "roupas"],
  [/entertainment|leisure|travel|tickets/i, "lazer"],
  [/gambling|betting|lottery/i, "apostas"],
  [/bank fees|fees|interest|late payment/i, "taxas"],
  [/cash withdrawal|atm/i, "saque"],
  [/tax/i, "impostos"],
  [/loan|financing|installment/i, "parcelas"],
  [/transfer|pix/i, "pix_pessoas"],
];
const PLUGGY_ENTRADA: Array<[RegExp, string]> = [
  [/refund|reversal|cashback/i, "estorno"],
  [/pix/i, "pix_recebido"],
  [/transfer/i, "transferencia_recebida"],
];

// deno-lint-ignore no-explicit-any
function categoria(t: any, tipo: "saida" | "entrada", alvo: string, proprio: boolean): { cat: string; conf: string } {
  if (proprio) return { cat: tipo === "saida" ? "transferencia_propria" : "transferencia_recebida", conf: "regra" };
  const dic = tipo === "saida" ? DIC_SAIDA : DIC_ENTRADA;
  const hit = dic.find(([re]) => re.test(alvo));
  if (hit) return { cat: hit[1], conf: "regra" };
  const cp = `${t?.category ?? ""} ${t?.operationType ?? ""} ${t?.paymentData?.paymentMethod ?? ""}`;
  const mapa = tipo === "saida" ? PLUGGY_SAIDA : PLUGGY_ENTRADA;
  const m = mapa.find(([re]) => re.test(cp));
  if (m) return { cat: m[1], conf: "padrao" };
  return tipo === "saida" ? { cat: "nao_identificado", conf: "baixa" } : { cat: "outros_entrada", conf: "padrao" };
}

// deno-lint-ignore no-explicit-any
function contraparte(t: any, tipo: "saida" | "entrada"): string {
  const pd = t?.paymentData ?? {};
  const outro = tipo === "saida" ? pd?.receiver : pd?.payer;
  return String(t?.merchant?.businessName ?? t?.merchant?.name ?? outro?.name ?? "");
}

const horaBRT = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** Saldo + movimentações de um item da Pluggy pro Raio-X. Devolve contagens. */
export async function importarPiloto(
  // deno-lint-ignore no-explicit-any
  admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, banco: string | null,
) {
  const contasRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, {
    headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000),
  });
  if (!contasRes.ok) return { saldos: 0, gravadas: 0, erro: `accounts ${contasRes.status}` };
  // deno-lint-ignore no-explicit-any
  const contas: any[] = ((await contasRes.json().catch(() => ({})))?.results ?? [])
    .filter((c: { type?: string }) => String(c?.type ?? "").toUpperCase() === "BANK");

  // 1) saldos
  let saldos = 0;
  for (const c of contas) {
    if (c?.balance == null) continue;
    const { error } = await admin.from("bank_saldos").upsert({
      conta_id: String(c.id), user_id: userId, bank_connection_id: conexaoId,
      banco: banco ?? null, nome: limpaNumeros(String(c?.name ?? c?.marketingName ?? "Conta")).slice(0, 40) || "Conta",
      saldo: Math.round(Number(c.balance) * 100) / 100, atualizado_em: new Date().toISOString(),
    }, { onConflict: "conta_id" });
    if (error) console.error("piloto: saldo", error.message); else saldos++;
  }

  // 2) janela: sempre o mês corrente inteiro. O id da Pluggy (pluggy_tx_id) garante
  //    que nada entra duas vezes, e um banco ligado no meio do mês ganha o mês todo.
  const dataDe = `${diaBRT(new Date()).slice(0, 7)}-01`;

  // meses em que o vendedor já mandou PDF deste banco: o PDF manda, não duplica
  const bancoNorm = norm(banco ?? "").split(" ")[0] ?? "";
  const { data: pdfs } = await admin.from("extrato_lancamentos")
    .select("banco, data").eq("user_id", userId).eq("origem", "arquivo").gte("data", dataDe.slice(0, 7) + "-01");
  const mesesComPdf = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const p of (pdfs ?? []) as any[]) {
    const b = norm(String(p.banco ?? ""));
    if (bancoNorm.length >= 3 && b.includes(bancoNorm)) mesesComPdf.add(String(p.data).slice(0, 7));
  }

  const { data: perfil } = await admin.from("profiles").select("cpf").eq("user_id", userId).maybeSingle();
  const cpf = String(perfil?.cpf ?? "").replace(/\D/g, "");
  const { data: cats } = await admin.from("extrato_categorias").select("slug, esfera_padrao");
  const esfera = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  for (const c of (cats ?? []) as any[]) esfera.set(c.slug, c.esfera_padrao);

  // deno-lint-ignore no-explicit-any
  const linhas: any[] = [];
  for (const conta of contas) {
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 8; pagina++) {
      const u = `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(conta.id)}&dateFrom=${dataDe}` +
        (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
      const r = await fetch(u, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) { console.error("piloto: transactions", r.status); break; }
      // deno-lint-ignore no-explicit-any
      const corpo: any = await r.json().catch(() => ({}));
      for (const t of (corpo?.results ?? [])) {
        const valor = Math.round(Math.abs(Number(t?.amount) || 0) * 100) / 100;
        if (!(valor > 0)) continue;
        const tipo: "saida" | "entrada" = String(t?.type).toUpperCase() === "DEBIT" ? "saida" : "entrada";
        const q = quandoFoi(t);
        if (q.dia < dataDe || mesesComPdf.has(q.dia.slice(0, 7))) continue;
        const descricao = limpaNumeros(String(t?.description ?? "")).slice(0, 60) || "Lançamento";
        const descNorm = norm(descricao) || "LANCAMENTO";
        const comerciante = (norm(limpaNumeros(contraparte(t, tipo))) || descNorm).slice(0, 40);
        const { cat, conf } = categoria(t, tipo, `${comerciante} ${descNorm}`, mesmoDono(t, cpf));
        linhas.push({
          user_id: userId, data: q.dia, hora: q.instante ? horaBRT(q.instante) : null,
          descricao, descricao_norm: descNorm, comerciante, valor, tipo,
          categoria: cat, esfera: esfera.get(cat) ?? "pessoal", confianca: conf,
          banco: banco ?? null, origem: "pluggy", pluggy_tx_id: String(t.id),
        });
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) break;
    }
  }
  if (linhas.length === 0) return { saldos, gravadas: 0 };

  // o que já entrou (mesmo id da Pluggy) não entra de novo — nem se a descrição mudou
  const ids = linhas.map((l) => l.pluggy_tx_id);
  const ja = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: existentes } = await admin.from("extrato_lancamentos")
      .select("pluggy_tx_id").eq("user_id", userId).in("pluggy_tx_id", ids.slice(i, i + 100));
    // deno-lint-ignore no-explicit-any
    for (const e of (existentes ?? []) as any[]) ja.add(String(e.pluggy_tx_id));
  }
  const novas = linhas.filter((l) => !ja.has(l.pluggy_tx_id));

  let gravadas = 0;
  for (let i = 0; i < novas.length; i += 200) {
    const { data: ins, error } = await admin.from("extrato_lancamentos")
      .upsert(novas.slice(i, i + 200), { onConflict: "user_id,data,valor,tipo,descricao_norm", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error("piloto: upsert", error.message); continue; }
    gravadas += (ins ?? []).length;
  }
  return { saldos, gravadas };
}
