import { describe, expect, it } from "vitest";
import { decidirPedido, reconciliar, lerPix, lerResposta, listaDeCompras, recorrenciaPendente, type Compra } from "./regras";

const DIA = 86_400_000;
const agora = new Date("2026-11-26T15:00:00Z");
const compra = (n: number, status: string, valor = 29.9, extra: Partial<Compra> = {}): Compra =>
  ({ transaction: `HP${n}${status}`, status, recurrency_number: n, payment_type: "PIX", price: { value: valor, currency_code: "BRL" }, ...extra });
const nossa = { subscription_id: "SUB1", status_hotmart: "PAST_DUE", forma_pagamento: "PIX", email: "ze@exemplo.com" };
const real = { subscription_id: 5011, status: "DELAYED", date_next_charge: agora.getTime() + 18 * DIA, email: "Ze@Exemplo.com" };

/** A well-formed Pix copia e cola (BR Code) with the given amount, check digits computed here. */
function pixDeTeste(valor?: string): string {
  const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;
  const semCrc = f("00", "01") + f("26", f("00", "br.gov.bcb.pix") + f("01", "chave-de-teste")) + f("52", "0000") + f("53", "986")
    + (valor ? f("54", valor) : "") + f("58", "BR") + f("59", "TESTE") + f("60", "SAO PAULO") + "6304";
  let crc = 0xffff;
  for (const ch of new TextEncoder().encode(semCrc)) { crc ^= ch << 8; for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
  return semCrc + crc.toString(16).toUpperCase().padStart(4, "0");
}

describe("Gerar Pix: what is pending at Hotmart", () => {
  it("accepts the three shapes of the purchase history (list, { items }, one object — sandbox 26/11)", () => {
    const c = compra(1, "APPROVED");
    expect(listaDeCompras([c])).toHaveLength(1);
    expect(listaDeCompras({ items: [c, c] })).toHaveLength(2);
    expect(listaDeCompras(c)).toHaveLength(1);
    expect(listaDeCompras(null)).toEqual([]);
    expect(listaDeCompras({ error: "not_found" })).toEqual([]);
  });
  it("one overdue recurrence: that one, with its own price", () => {
    expect(recorrenciaPendente([compra(1, "APPROVED"), compra(2, "OVERDUE", 28.41)])).toEqual({ recorrencia: 2, valor: 28.41, status: "OVERDUE", atrasadas: [2] });
  });
  it("several overdue recurrences: only the LAST is negotiated; the others are listed", () => {
    const p = recorrenciaPendente([compra(1, "COMPLETE"), compra(2, "OVERDUE"), compra(3, "EXPIRED"), compra(4, "OVERDUE")]);
    expect(p).toMatchObject({ recorrencia: 4, atrasadas: [2, 3, 4] });
  });
  it("an expired Pix and its paid retry share the number: that recurrence is paid", () => {
    expect(recorrenciaPendente([compra(1, "APPROVED"), compra(2, "EXPIRED"), compra(2, "APPROVED")])).toBeNull();
  });
  it("everything paid, or no history: nothing pending", () => {
    expect(recorrenciaPendente([compra(1, "APPROVED"), compra(2, "COMPLETE")])).toBeNull();
    expect(recorrenciaPendente([])).toBeNull();
  });
});

describe("Gerar Pix: may we ask Hotmart for a Pix?", () => {
  const historico = [compra(1, "APPROVED"), compra(2, "OVERDUE")];
  it("overdue, same buyer, pending recurrence: negotiate the last one, keeping Hotmart's next charge", () => {
    expect(decidirPedido(nossa, real, historico)).toEqual({ acao: "negociar", hotmart_id: 5011, recorrencia: 2, valor: 29.9,
      proxima_cobranca: new Date(real.date_next_charge).toISOString(), atrasadas: [2] });
  });
  it("Pix Automático stays out of the first version", () => {
    expect(decidirPedido({ ...nossa, forma_pagamento: "PIX_AUTOMATIC" }, real, historico)).toEqual({ acao: "recusar", motivo: "pix_automatico" });
  });
  it("already active at Hotmart: nothing to charge (the check releases the access)", () => {
    expect(decidirPedido(nossa, { ...real, status: "ACTIVE" }, historico)).toEqual({ acao: "recusar", motivo: "em_dia" });
  });
  it.each(["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_SELLER", "CANCELLED_BY_ADMIN", "INACTIVE", "STARTED", ""])("closed or not overdue at Hotmart (%s): no negotiation → subscribe again", (status) => {
    expect(decidirPedido(nossa, { ...real, status }, historico)).toEqual({ acao: "recusar", motivo: "encerrada" });
  });
  it("the subscriber at Hotmart is not the buyer linked to the account: nothing is generated", () => {
    expect(decidirPedido(nossa, { ...real, email: "outro@exemplo.com" }, historico)).toEqual({ acao: "recusar", motivo: "titular_nao_confere" });
    expect(decidirPedido({ ...nossa, email: null }, real, historico)).toEqual({ acao: "recusar", motivo: "titular_nao_confere" });
  });
  it("no pending recurrence, no price, or no numeric id: nothing is generated", () => {
    expect(decidirPedido(nossa, real, [compra(1, "APPROVED")])).toEqual({ acao: "recusar", motivo: "sem_pendencia" });
    expect(decidirPedido(nossa, real, [compra(1, "APPROVED"), { ...compra(2, "OVERDUE"), price: undefined }])).toEqual({ acao: "recusar", motivo: "sem_valor" });
    expect(decidirPedido(nossa, { ...real, subscription_id: null }, historico)).toEqual({ acao: "recusar", motivo: "sem_numero_da_assinatura" });
  });
});

describe("Gerar Pix: reading Hotmart's answer without risking a second charge", () => {
  const pix = pixDeTeste("29.90");
  const ok = { subscription_id: 5011, transaction: "HP0001", payment: { type: "PIX", expiration_date: agora.getTime() + 2 * DIA, pix_code: pix, pix_qrcode: "https://exemplo.com/qr" } };
  it("a valid Pix copia e cola is recognised and its amount read", () => {
    expect(lerPix(pix)).toEqual({ valido: true, valor: 29.9 });
    expect(lerPix(pixDeTeste())).toEqual({ valido: true, valor: null });
    expect(lerPix(pix.slice(0, -1) + (pix.endsWith("0") ? "1" : "0"))).toEqual({ valido: false, valor: null });
    expect(lerPix("34191765020370800372214245740007295280000054956")).toEqual({ valido: false, valor: null });
  });
  it("Pix came back: gerado, with transaction, expiry, link and the amount inside the Pix", () => {
    expect(lerResposta(200, ok)).toEqual({ resultado: "gerado", transacao: "HP0001", pix_code: pix, pix_qrcode: "https://exemplo.com/qr",
      vence_em: new Date(agora.getTime() + 2 * DIA).toISOString(), valor_no_pix: 29.9 });
  });
  it("Hotmart refused (4xx): falhou — no charge exists, asking again is safe", () => {
    expect(lerResposta(400, { error: "invalid_parameter", error_description: "x" })).toMatchObject({ resultado: "falhou" });
    expect(lerResposta(403, null)).toMatchObject({ resultado: "falhou" });
  });
  it.each([[null, null], [500, null], [502, "bad gateway"], [408, null]])("no answer or server error (%s): incerto — never repeated blindly", (http, corpo) => {
    expect(lerResposta(http, corpo)).toMatchObject({ resultado: "incerto" });
  });
  it("answer 200 without a usable Pix (the sandbox boleto, a broken code, no transaction): incerto — a charge may exist", () => {
    expect(lerResposta(200, { subscription_id: 85097, transaction: "HP00044923", payment: { type: "BILLET", billet_barcode: "3419…" } })).toMatchObject({ resultado: "incerto" });
    expect(lerResposta(200, { ...ok, payment: { ...ok.payment, pix_code: "000201quebrado6304FFFF" } })).toMatchObject({ resultado: "incerto" });
    expect(lerResposta(200, { ...ok, transaction: undefined })).toMatchObject({ resultado: "incerto" });
  });
});

describe("Gerar Pix: reconciliação de um pedido incerto (o botão fica bloqueado até aqui decidir)", () => {
  const antes = ["HP1APPROVED", "HP2OVERDUE"];
  const lista = [compra(1, "APPROVED"), compra(2, "OVERDUE")];
  const haPouco = new Date(agora.getTime() - 3 * 60_000).toISOString();
  const haMeiaHora = new Date(agora.getTime() - 30 * 60_000).toISOString();
  it("apareceu uma transação que não existia antes → a cobrança existe na Hotmart: continua bloqueado, guarda a transação", () => {
    expect(reconciliar(antes, [...lista, compra(2, "WAITING_PAYMENT", 29.9, { transaction: "HPNOVA" })], haPouco, agora)).toEqual({ resultado: "cobranca_existe", transacao: "HPNOVA" });
  });
  it("essa transação nova venceu ou foi cancelada sem pagar → libera um novo pedido", () => {
    expect(reconciliar(antes, [...lista, compra(2, "EXPIRED", 29.9, { transaction: "HPNOVA" })], haMeiaHora, agora)).toEqual({ resultado: "cobranca_encerrada", transacao: "HPNOVA" });
  });
  it("nada novo e já passaram 15 minutos → a Hotmart não criou cobrança: libera", () => {
    expect(reconciliar(antes, lista, haMeiaHora, agora)).toEqual({ resultado: "sem_cobranca" });
  });
  it("nada novo ainda, pedido recente → espera (continua bloqueado)", () => {
    expect(reconciliar(antes, lista, haPouco, agora)).toEqual({ resultado: "aguardar" });
  });
  it("sem a lista de antes não dá pra concluir → continua bloqueado, nunca libera no escuro", () => {
    expect(reconciliar(null, lista, haMeiaHora, agora)).toEqual({ resultado: "aguardar" });
    expect(reconciliar(undefined, [], "data-invalida", agora)).toEqual({ resultado: "aguardar" });
    expect(reconciliar(antes, lista, "data-invalida", agora)).toEqual({ resultado: "aguardar" });
  });
});
