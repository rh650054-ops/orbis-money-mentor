// Vant — PILOTO AUTOMÁTICO (etapa 3 do Open Finance, 02/10/2026).
// A cada leitura do banco (pluggy-hora), além do Pix que vai pro ranking:
//   • grava o SALDO de cada conta BANK em bank_saldos ("quanto você tem agora");
//   • joga cada movimentação (saída e entrada) no Raio-X (extrato_lancamentos,
//     origem 'pluggy'), já com categoria. Mesma régua do extrato em PDF:
//     dicionário de comerciantes primeiro, depois a categoria que a Pluggy manda,
//     e a inteligência do banco (extrato_analisar_padroes) fecha o resto.
// Nunca grava número de conta/agência/CPF: a descrição passa por limpaNumeros.
// Se o vendedor já mandou PDF desse banco no mês, o mês fica com o PDF (não duplica).
//
// 03/10/2026 (Rick: "cada gasto tem que entrar numa categoria"):
//   • "entre minhas contas" numa SAÍDA olha quem RECEBEU (antes olhava quem pagou,
//     que é sempre o próprio vendedor, e toda saída virava transferência própria);
//   • "Débito de Cartão" sem nome de loja vai pra "Compras no débito";
//   • compras do CARTÃO DE CRÉDITO entram também (do_cartao = true);
//   • o que entrou com a categoria errada pelo bug é corrigido na leitura seguinte.

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

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Saída pra conta do próprio vendedor: quem RECEBEU tem o CPF dele. */
// deno-lint-ignore no-explicit-any
function recebedorEhDono(t: any, cpf: string): boolean {
  if (cpf.length !== 11) return false;
  const doc = t?.paymentData?.receiver?.documentNumber;
  const v = soDigitos(typeof doc === "object" && doc ? doc.value : doc);
  return v.length === 11 && v === cpf;
}

/** "Débito de Cartão" sem loja: a Pluggy não manda o nome do comerciante. */
// deno-lint-ignore no-explicit-any
const debitoSemLoja = (t: any) =>
  /^(d[eé]bito de cart[aã]o|compra (no|com) (cart[aã]o de )?d[eé]bito)$/i.test(String(t?.description ?? "").trim())
  && !t?.merchant?.name && !t?.merchant?.businessName;

// deno-lint-ignore no-explicit-any
function categoria(t: any, tipo: "saida" | "entrada", alvo: string, proprio: boolean): { cat: string; conf: string } {
  if (proprio) return { cat: tipo === "saida" ? "transferencia_propria" : "transferencia_recebida", conf: "regra" };
  if (tipo === "saida" && debitoSemLoja(t)) return { cat: "compras_debito", conf: "padrao" };
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
  const todas: any[] = (await contasRes.json().catch(() => ({})))?.results ?? [];
  const tipoConta = (c: { type?: string }) => String(c?.type ?? "").toUpperCase();
  const contas = todas.filter((c) => tipoConta(c) === "BANK" || tipoConta(c) === "CREDIT");

  // primeira leitura deste banco? (04/10, Mohamed: "meus bancos pessoais ainda não chegaram")
  const { count: jaLido } = await admin.from("bank_saldos")
    .select("conta_id", { count: "exact", head: true }).eq("bank_connection_id", conexaoId);

  // 1) saldos (só conta corrente; o cartão mora em bank_cartoes, etapa 4)
  let saldos = 0;
  for (const c of contas.filter((x) => tipoConta(x) === "BANK")) {
    if (c?.balance == null) continue;
    const { error } = await admin.from("bank_saldos").upsert({
      conta_id: String(c.id), user_id: userId, bank_connection_id: conexaoId,
      banco: banco ?? null, nome: limpaNumeros(String(c?.name ?? c?.marketingName ?? "Conta")).slice(0, 40) || "Conta",
      saldo: Math.round(Number(c.balance) * 100) / 100, atualizado_em: new Date().toISOString(),
    }, { onConflict: "conta_id" });
    if (error) console.error("piloto: saldo", error.message); else saldos++;
  }

  // 2) janela. O id da Pluggy (pluggy_tx_id) garante que nada entra duas vezes.
  //    • banco recém-ligado: os 2 meses anteriores + o atual, pro Raio-X já nascer com histórico;
  //    • até o dia 7: o mês anterior também — o Open Finance entrega atrasado o que caiu
  //      no fim do mês (04/10: Pix do dia 29-30/09 chegando no dia 2);
  //    • depois: o mês corrente inteiro.
  const hoje = diaBRT(new Date());
  const voltar = !jaLido ? 2 : Number(hoje.slice(8, 10)) <= 7 ? 1 : 0;
  const ini = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 - voltar, 1));
  const dataDe = ini.toISOString().slice(0, 10);

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
    const cartao = tipoConta(conta) === "CREDIT";
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
        // no cartão de crédito só a COMPRA é gasto; pagamento e estorno da fatura ficam de fora
        if (cartao && tipo !== "saida") continue;
        const q = quandoFoi(t);
        if (q.dia < dataDe || mesesComPdf.has(q.dia.slice(0, 7))) continue;
        const descricao = debitoSemLoja(t) ? "Compra no débito"
          : limpaNumeros(String(t?.description ?? "")).slice(0, 60) || "Lançamento";
        const descNorm = norm(descricao) || "LANCAMENTO";
        const comerciante = (norm(limpaNumeros(contraparte(t, tipo))) || descNorm).slice(0, 40);
        const proprio = tipo === "saida" ? recebedorEhDono(t, cpf) : mesmoDono(t, cpf);
        const { cat, conf } = categoria(t, tipo, `${comerciante} ${descNorm}`, proprio);
        linhas.push({
          user_id: userId, data: q.dia, hora: q.instante ? horaBRT(q.instante) : null,
          descricao, descricao_norm: descNorm, comerciante, valor, tipo,
          categoria: cat, esfera: esfera.get(cat) ?? "pessoal", confianca: conf,
          banco: banco ?? null, origem: "pluggy", pluggy_tx_id: String(t.id), do_cartao: cartao,
        });
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) break;
    }
  }
  if (linhas.length === 0) return { saldos, gravadas: 0, corrigidas: 0 };

  // o que já entrou (mesmo id da Pluggy) não entra de novo — nem se a descrição mudou
  const ids = linhas.map((l) => l.pluggy_tx_id);
  // deno-lint-ignore no-explicit-any
  const ja = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: existentes } = await admin.from("extrato_lancamentos")
      .select("id, pluggy_tx_id, categoria, confianca, descricao").eq("user_id", userId).in("pluggy_tx_id", ids.slice(i, i + 100));
    // deno-lint-ignore no-explicit-any
    for (const e of (existentes ?? []) as any[]) ja.set(String(e.pluggy_tx_id), e);
  }
  const novas = linhas.filter((l) => !ja.has(l.pluggy_tx_id));

  // conserto (03/10): o que entrou como "entre minhas contas" pelo bug do CPF, ou como
  // "Débito de Cartão" sem categoria, ganha a categoria certa. O que o vendedor mexeu fica.
  let corrigidas = 0;
  for (const l of linhas) {
    const e = ja.get(l.pluggy_tx_id);
    if (!e || e.confianca === "usuario" || e.categoria === l.categoria) continue;
    const bugCpf = e.categoria === "transferencia_propria" && l.categoria !== "transferencia_propria";
    const semLoja = l.categoria === "compras_debito" && ["nao_identificado", "outros"].includes(e.categoria);
    if (!bugCpf && !semLoja) continue;
    const { error } = await admin.from("extrato_lancamentos").update({
      categoria: l.categoria, esfera: l.esfera, confianca: l.confianca, movimento: "normal", par_id: null,
      descricao: l.descricao, descricao_norm: l.descricao_norm, comerciante: l.comerciante,
    }).eq("id", e.id);
    if (error) console.error("piloto: corrigir", error.message); else corrigidas++;
  }

  let gravadas = 0;
  for (let i = 0; i < novas.length; i += 200) {
    const { data: ins, error } = await admin.from("extrato_lancamentos")
      .upsert(novas.slice(i, i + 200), { onConflict: "user_id,data,valor,tipo,descricao_norm", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error("piloto: upsert", error.message); continue; }
    gravadas += (ins ?? []).length;
  }
  return { saldos, gravadas, corrigidas };
}
