// @vitest-environment node
/* Pagamento aprovado NUNCA pode virar "concluído" se a assinatura não gravou:
   a falha devolve 500 e libera o evento, e o reenvio da Hotmart é processado. */
import { beforeAll, describe, expect, it, vi } from "vitest";

type Resultado = { data: unknown; error: { message: string; code?: string } | null };

function supabaseFalso(opts: { falhar?: Set<string>; achar?: string | null; perfis?: Set<string>; negociacoes?: Record<string, Record<string, unknown>>; assinaturas?: Record<string, Record<string, unknown>>; semTabelaDeNegociacoes?: boolean } = {}) {
  const marcados = new Set<string>();
  const chamadas: string[] = [];
  const falhar = opts.falhar ?? new Set<string>();
  const achar = opts.achar === undefined ? "user-1" : opts.achar;
  const perfis = opts.perfis ?? new Set<string>();
  const gravados: { tabela: string; op: string; linha: Record<string, unknown> }[] = [];

  const tabela = (t: string) => {
    let op = "select";
    let linha: Record<string, unknown> = {};
    let filtroUser: unknown = null;
    let filtroTransacao: unknown = null;
    let filtroAssinatura: unknown = null;
    const q = {
      insert(v: Record<string, unknown>) { op = "insert"; linha = v; return q; },
      upsert(v: Record<string, unknown>) { op = "upsert"; linha = v; return q; },
      update(v: Record<string, unknown>) { op = "update"; linha = v; return q; },
      delete() { op = "delete"; return q; },
      select() { return q; },
      eq(col: string, v: unknown) {
        if (col === "event_id") linha = { event_id: v };
        if (col === "user_id") filtroUser = v;
        if (col === "transacao") filtroTransacao = v;
        if (col === "subscription_id") filtroAssinatura = v;
        return q;
      },
      ilike() { return q; },
      is() { return q; },
      maybeSingle() { return q; },
      single() { return q; },
      then(res: (r: Resultado) => unknown, rej?: (e: unknown) => unknown) {
        const k = `${t}.${op}`;
        chamadas.push(k);
        if (op !== "select") gravados.push({ tabela: t, op, linha });
        let r: Resultado = { data: null, error: null };
        if (falhar.has(k)) r = { data: null, error: { message: "falhou" } };
        else if (t === "profiles" && op === "select" && perfis.has(String(filtroUser))) {
          r = { data: { user_id: filtroUser }, error: null };
        }
        else if (t === "hotmart_negociacoes" && op === "select") {
          r = opts.semTabelaDeNegociacoes ? { data: null, error: { message: "relation does not exist", code: "42P01" } }
            : { data: opts.negociacoes?.[String(filtroTransacao)] ?? null, error: null };
        }
        else if (t === "orbis_hotmart_assinatura" && op === "select" && filtroAssinatura) {
          r = { data: opts.assinaturas?.[String(filtroAssinatura)] ?? null, error: null };
        }
        else if (t === "processed_hotmart_events" && op === "insert") {
          const id = String(linha.event_id);
          if (marcados.has(id)) r = { data: null, error: { message: "dup", code: "23505" } };
          else marcados.add(id);
        } else if (t === "processed_hotmart_events" && op === "delete") {
          marcados.delete(String(linha.event_id));
        }
        return Promise.resolve(r).then(res, rej);
      },
    };
    return q;
  };

  const cliente = {
    from: tabela,
    rpc: (nome: string, args?: Record<string, unknown>) => {
      chamadas.push(`rpc.${nome}`);
      if (args) gravados.push({ tabela: `rpc.${nome}`, op: "rpc", linha: args });
      if (falhar.has(`rpc.${nome}`)) return Promise.resolve({ data: null, error: { message: "falhou" } });
      if (nome === "hotmart_negociacao_paga") { const n = Object.values(opts.negociacoes ?? {}).find((x) => x.id === args?.p_id); if (n) n.status = "pago"; }
      return Promise.resolve({ data: nome === "orbis_achar_usuario" ? achar : true, error: null });
    },
  };
  return { cliente, chamadas, marcados, falhar, gravados };
}

const pedido = (offer = "8qbxvm9p", event = "PURCHASE_APPROVED", xcod?: string) =>
  new Request("https://x/hotmart-webhook", {
    method: "POST",
    headers: { "x-hotmart-hottok": "segredo-teste", "content-type": "application/json" },
    body: JSON.stringify({
      id: `ev-${offer}-${event}-${xcod ?? ""}`,
      event,
      data: {
        buyer: { email: "comprador@exemplo.com" },
        purchase: { transaction: "T1", offer: { code: offer }, recurrence_number: 1, date_next_charge: Date.now() + 30 * 86_400_000, ...(xcod ? { origin: { xcod } } : {}) },
        subscription: { subscriber: { code: "S1" } },
      },
    }),
  });

let tratarHotmart: (req: Request, criar: () => never) => Promise<Response>;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (k: string) => (k === "HOTMART_HOTTOK" ? "segredo-teste" : "x") },
    serve: () => {},
  };
  ({ tratarHotmart } = (await import("./index")) as unknown as { tratarHotmart: typeof tratarHotmart });
});

describe("hotmart-webhook: evento repetido (26/11)", () => {
  it("o mesmo PURCHASE_APPROVED duas vezes libera o acesso uma vez só (sem segunda assinatura)", async () => {
    const sb = supabaseFalso();
    const r1 = await tratarHotmart(pedido(), () => sb.cliente as never);
    const r2 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r1.status).toBe(200);
    expect(await r2.json()).toEqual({ status: "duplicate" });
    expect(sb.chamadas.filter((c) => c === "rpc.hotmart_acesso_aplicar")).toHaveLength(1);
  });
});

describe("hotmart-webhook: recebido ≠ concluído", () => {
  it("assinatura não gravou → 500, evento liberado, e o reenvio da Hotmart ativa a assinatura", async () => {
    const sb = supabaseFalso({ falhar: new Set(["rpc.hotmart_acesso_aplicar"]) });
    const r1 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r1.status).toBe(500);
    expect(sb.marcados.size).toBe(0); // não ficou "processado"
    expect(sb.chamadas).not.toContain("rpc.pro_conceder");

    sb.falhar.clear(); // Hotmart reenvia, banco voltou
    const r2 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ status: "ok" });
    expect(sb.marcados.size).toBe(1);
    expect(sb.chamadas.filter((c) => c === "rpc.hotmart_acesso_aplicar")).toHaveLength(2);
  });

  it("Pro não liberou (pro_conceder) → libera pra reenvio", async () => {
    const sb = supabaseFalso({ falhar: new Set(["rpc.pro_conceder"]) });
    const r = await tratarHotmart(pedido("5y86n311"), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
  });

  it("banco extra não registrou → libera pra reenvio", async () => {
    const sb = supabaseFalso({ falhar: new Set(["rpc.banco_extra_registrar"]) });
    const r = await tratarHotmart(pedido("3nnrr1xn"), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
  });

  it("deu tudo certo → concluído, e o reenvio vira duplicado (não estende 2x)", async () => {
    const sb = supabaseFalso();
    expect((await tratarHotmart(pedido(), () => sb.cliente as never)).status).toBe(200);
    const r2 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(await r2.json()).toEqual({ status: "duplicate" });
    expect(sb.chamadas.filter((c) => c === "rpc.hotmart_acesso_aplicar")).toHaveLength(1);
  });

  it("cancelamento que não gravou → libera pra reenvio (não deixa acesso aberto)", async () => {
    const sb = supabaseFalso({ falhar: new Set(["rpc.hotmart_acesso_aplicar"]) });
    const r = await tratarHotmart(pedido("8qbxvm9p", "SUBSCRIPTION_CANCELLATION"), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
  });
});

describe("hotmart-webhook: fallback pelo xcod", () => {
  const UID = "3f2b8c1e-9a7d-4e21-b6c3-0d5e4f6a7b8c";
  const assinaturaDe = (sb: ReturnType<typeof supabaseFalso>) => {
    const l = sb.gravados.find((g) => g.tabela === "rpc.hotmart_acesso_aplicar")?.linha;
    return l ? { user_id: l.p_user } : undefined;
  };

  it("e-mail/CPF diferentes na Hotmart → acha a conta pelo xcod e ativa", async () => {
    const sb = supabaseFalso({ achar: null, perfis: new Set([UID]) });
    const r = await tratarHotmart(pedido("8qbxvm9p", "PURCHASE_APPROVED", UID), () => sb.cliente as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(assinaturaDe(sb)?.user_id).toBe(UID);
    expect(sb.chamadas).not.toContain("unlinked_purchases.insert");
  });

  it("xcod de perfil que não existe → continua indo pra unlinked", async () => {
    const sb = supabaseFalso({ achar: null });
    const r = await tratarHotmart(pedido("8qbxvm9p", "PURCHASE_APPROVED", UID), () => sb.cliente as never);
    expect(await r.json()).toEqual({ status: "unlinked" });
    expect(sb.chamadas).toContain("unlinked_purchases.insert");
  });

  it("busca pelo xcod deu erro → 500 e libera o evento (não vira compra sem dono)", async () => {
    const sb = supabaseFalso({ achar: null, perfis: new Set([UID]), falhar: new Set(["profiles.select"]) });
    const r = await tratarHotmart(pedido("8qbxvm9p", "PURCHASE_APPROVED", UID), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
    expect(sb.chamadas).not.toContain("unlinked_purchases.insert");
  });

  it("xcod que não é UUID nem é consultado", async () => {
    const sb = supabaseFalso({ achar: null, perfis: new Set(["nao-uuid"]) });
    const r = await tratarHotmart(pedido("8qbxvm9p", "PURCHASE_APPROVED", "nao-uuid"), () => sb.cliente as never);
    expect(await r.json()).toEqual({ status: "unlinked" });
    expect(sb.chamadas).not.toContain("profiles.select");
  });
});

describe("hotmart-webhook: dia fixo e a assinatura certa (Rick, 04/11)", () => {
  const corpo = (event: string, data: Record<string, unknown>) =>
    new Request("https://x/hotmart-webhook", {
      method: "POST",
      headers: { "x-hotmart-hottok": "segredo-teste", "content-type": "application/json" },
      body: JSON.stringify({ id: `ev-${event}-${JSON.stringify(data).length}`, event, data }),
    });
  const args = (sb: ReturnType<typeof supabaseFalso>) =>
    sb.gravados.find((g) => g.tabela === "rpc.hotmart_acesso_aplicar")?.linha;

  it("aprovado → fim = próxima cobrança da Hotmart; COMPLETE avisa a função", async () => {
    const prox = Date.now() + 20 * 86_400_000;
    const sb = supabaseFalso();
    await tratarHotmart(corpo("PURCHASE_COMPLETE", {
      buyer: { email: "a@b.com" }, purchase: { transaction: "T9", offer: { code: "8qbxvm9p" }, date_next_charge: prox },
      subscription: { subscriber: { code: "S9" } },
    }), () => sb.cliente as never);
    expect(args(sb)).toMatchObject({ p_acao: "ativar", p_sub: "S9", p_complete: true, p_fim: new Date(prox).toISOString() });
  });

  it("cancelamento só com data.subscriber.code → identifica a assinatura", async () => {
    const sb = supabaseFalso();
    await tratarHotmart(corpo("SUBSCRIPTION_CANCELLATION", {
      buyer: { email: "a@b.com" }, subscriber: { code: "OLD1" }, subscription: {},
    }), () => sb.cliente as never);
    expect(args(sb)).toMatchObject({ p_acao: "cancelar", p_sub: "OLD1" });
  });
});

/* "Gerar Pix" (26/11): the payment of a Pix VANT asked Hotmart for, with FICTITIOUS transactions
   (the sandbox cannot simulate it). The link is the transaction code stored in hotmart_negociacoes. */
describe("hotmart-webhook: pagamento de negociação (Gerar Pix)", () => {
  const DIA = 86_400_000;
  const prox = Date.now() + 18 * DIA;
  const neg = (extra: Record<string, unknown> = {}) => ({ id: "neg-1", user_id: "dono-da-negociacao", assinatura: "SUBNEG", recorrencia: 3, proxima_cobranca: new Date(prox).toISOString(), status: "gerado", ...extra });
  const evento = (tx: string, compra: Record<string, unknown> = {}, sub: string | null = "SUBNEG", event = "PURCHASE_APPROVED", plano = "VANT Essencial") =>
    new Request("https://x/hotmart-webhook", {
      method: "POST", headers: { "x-hotmart-hottok": "segredo-teste", "content-type": "application/json" },
      body: JSON.stringify({ id: `ev-${tx}-${event}-${JSON.stringify(compra).length}`, event, data: {
        buyer: { email: "outro-email@exemplo.com" },
        purchase: { transaction: tx, status: "APPROVED", payment: { type: "PIX" }, ...compra },
        subscription: { status: "DELAYED", plan: { name: plano }, ...(sub ? { subscriber: { code: sub } } : {}) },
      } }),
    });
  const ativar = (sb: ReturnType<typeof supabaseFalso>) => sb.gravados.filter((g) => g.tabela === "rpc.hotmart_acesso_aplicar").map((g) => g.linha);
  const pendencias = (sb: ReturnType<typeof supabaseFalso>) => sb.gravados.filter((g) => g.tabela === "unlinked_purchases").map((g) => String(g.linha.event_type));
  const corpo = async (r: Response) => await r.json() as Record<string, unknown>;

  it("N1 · transação da negociação aprovada → libera a conta, a assinatura e o prazo da NEGOCIAÇÃO (não do e-mail do comprador)", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG1: neg() }, achar: "conta-achada-pelo-email" });
    const r = await tratarHotmart(evento("HPNEG1", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    expect(await corpo(r)).toEqual({ status: "ok", negociacao: "liberada" });
    expect(ativar(sb)).toEqual([{ p_user: "dono-da-negociacao", p_acao: "ativar", p_sub: "SUBNEG", p_purchase: "HPNEG1", p_fim: new Date(prox).toISOString(), p_complete: false }]);
    expect(sb.chamadas).toContain("rpc.hotmart_negociacao_paga");
  });

  it("N2 · status da assinatura ainda DELAYED e evento sem próxima cobrança → vale a data guardada na geração do Pix", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG2: neg() } });
    await tratarHotmart(evento("HPNEG2", { recurrence_number: 3 }), () => sb.cliente as never);
    expect(ativar(sb)[0]).toMatchObject({ p_user: "dono-da-negociacao", p_fim: new Date(prox).toISOString() });
  });

  it("N3 · recorrência antiga paga sem nenhuma data futura comprovada → marca paga, NÃO libera 30 dias, vai pra lista do admin", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG3: neg({ proxima_cobranca: new Date(Date.now() - 5 * DIA).toISOString() }) } });
    const r = await tratarHotmart(evento("HPNEG3", { recurrence_number: 3, date_next_charge: Date.now() - 5 * DIA }), () => sb.cliente as never);
    expect(await corpo(r)).toEqual({ status: "ok", negociacao: "paga_sem_prazo" });
    expect(ativar(sb)).toEqual([]);
    expect(pendencias(sb)).toEqual(["PURCHASE_APPROVED:NEGOCIACAO_PAGA_SEM_PRAZO"]);
    expect(sb.chamadas).toContain("rpc.hotmart_negociacao_paga");
  });

  it("N4 · APPROVED e depois COMPLETE da mesma transação → libera uma vez só", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG4: neg() } });
    await tratarHotmart(evento("HPNEG4", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    const r2 = await tratarHotmart(evento("HPNEG4", { recurrence_number: 3, date_next_charge: prox + 30 * DIA }, "SUBNEG", "PURCHASE_COMPLETE"), () => sb.cliente as never);
    expect(await corpo(r2)).toEqual({ status: "ok", negociacao: "ja_paga" });
    expect(ativar(sb)).toHaveLength(1);
  });

  it("N5 · o mesmo aviso reenviado pela Hotmart → duplicado, nada de novo", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG5: neg() } });
    await tratarHotmart(evento("HPNEG5", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    const r2 = await tratarHotmart(evento("HPNEG5", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    expect(await corpo(r2)).toEqual({ status: "duplicate" });
    expect(ativar(sb)).toHaveLength(1);
  });

  it.each([["assinatura", { recurrence_number: 3 }, "OUTRASUB"], ["recorrencia", { recurrence_number: 4 }, "SUBNEG"]])("N6 · evento com %s diferente da negociação → nada liberado, vai pra lista do admin", async (motivo, compra, sub) => {
    const sb = supabaseFalso({ negociacoes: { HPNEG6: neg() } });
    const r = await tratarHotmart(evento("HPNEG6", { ...compra, date_next_charge: prox }, sub), () => sb.cliente as never);
    expect(await corpo(r)).toEqual({ status: "ok", negociacao: "divergente" });
    expect(ativar(sb)).toEqual([]);
    expect(sb.chamadas).not.toContain("rpc.hotmart_negociacao_paga");
    expect(pendencias(sb)).toEqual([`PURCHASE_APPROVED:NEGOCIACAO_DIVERGENTE_${motivo.toUpperCase()}`]);
  });

  it("N7 · evento da negociação sem bloco da assinatura, sem oferta e comprador não encontrado → libera pelo vínculo; Pro volta pelo registro da assinatura", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG7: neg() }, achar: null, assinaturas: { SUBNEG: { oferta_codigo: "5y86n311", plano: "Vant Pro" } } });
    await tratarHotmart(evento("HPNEG7", { date_next_charge: prox }, null, "PURCHASE_APPROVED", ""), () => sb.cliente as never);
    expect(ativar(sb)[0]).toMatchObject({ p_user: "dono-da-negociacao", p_sub: "SUBNEG" });
    expect(sb.gravados.find((g) => g.tabela === "rpc.pro_conceder")?.linha).toMatchObject({ p_user: "dono-da-negociacao", p_codigo: "SUBNEG", p_produto: "5y86n311", p_ate: new Date(prox + 3 * DIA).toISOString() });
  });

  it("N8 · negociação do plano comum → não dá Pro", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG8: neg() }, assinaturas: { SUBNEG: { oferta_codigo: "8qbxvm9p", plano: "Membro Fundador" } } });
    await tratarHotmart(evento("HPNEG8", { recurrence_number: 3, date_next_charge: prox, offer: { code: "8qbxvm9p" } }), () => sb.cliente as never);
    expect(sb.chamadas).not.toContain("rpc.pro_conceder");
  });

  it("N9 · liberar falhou → 500, negociação NÃO fica paga, e o reenvio da Hotmart libera", async () => {
    const sb = supabaseFalso({ negociacoes: { HPNEG9: neg() }, falhar: new Set(["rpc.hotmart_acesso_aplicar"]) });
    const r1 = await tratarHotmart(evento("HPNEG9", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    expect(r1.status).toBe(500);
    expect(sb.chamadas).not.toContain("rpc.hotmart_negociacao_paga");
    sb.falhar.clear();
    const r2 = await tratarHotmart(evento("HPNEG9", { recurrence_number: 3, date_next_charge: prox }), () => sb.cliente as never);
    expect(await corpo(r2)).toEqual({ status: "ok", negociacao: "liberada" });
  });
});

describe("hotmart-webhook: cobrança achada pela reconciliação (pedido incerto)", () => {
  it("N10 · pedido incerto cuja transação foi gravada na reconciliação e paga na Hotmart → libera pelo mesmo vínculo", async () => {
    const prox = Date.now() + 12 * 86_400_000;
    const sb = supabaseFalso({ negociacoes: { HPNOVA9: { id: "neg-9", user_id: "dono", assinatura: "SUBC", recorrencia: 4, proxima_cobranca: new Date(prox).toISOString(), status: "incerto" } } });
    const r = await tratarHotmart(new Request("https://x/hotmart-webhook", {
      method: "POST", headers: { "x-hotmart-hottok": "segredo-teste", "content-type": "application/json" },
      body: JSON.stringify({ id: "ev-neg-incerto", event: "PURCHASE_APPROVED", data: { buyer: { email: "x@y.com" },
        purchase: { transaction: "HPNOVA9", recurrence_number: 4, date_next_charge: prox }, subscription: { subscriber: { code: "SUBC" } } } }),
    }), () => sb.cliente as never);
    expect(await r.json()).toEqual({ status: "ok", negociacao: "liberada" });
    expect(sb.gravados.find((g) => g.tabela === "rpc.hotmart_acesso_aplicar")?.linha).toMatchObject({ p_user: "dono", p_sub: "SUBC", p_fim: new Date(prox).toISOString() });
    expect(sb.chamadas).toContain("rpc.hotmart_negociacao_paga");
  });
});

describe("hotmart-webhook: pagamento que NÃO é negociação da VANT (regra do prazo, 26/11)", () => {
  const DIA = 86_400_000;
  const evento = (compra: Record<string, unknown>, sub: string | null = "S9") =>
    new Request("https://x/hotmart-webhook", {
      method: "POST", headers: { "x-hotmart-hottok": "segredo-teste", "content-type": "application/json" },
      body: JSON.stringify({ id: `ev-prazo-${JSON.stringify(compra)}-${sub}`, event: "PURCHASE_APPROVED", data: {
        buyer: { email: "a@b.com" }, purchase: { transaction: "TX", offer: { code: "8qbxvm9p" }, ...compra },
        subscription: sub ? { subscriber: { code: sub } } : {},
      } }),
    });
  const fim = (sb: ReturnType<typeof supabaseFalso>) => sb.gravados.find((g) => g.tabela === "rpc.hotmart_acesso_aplicar")?.linha.p_fim;
  const perto = (iso: unknown, alvo: number) => Math.abs(Date.parse(String(iso)) - alvo) < 60_000;

  it("R1 · compra normal (assinatura + próxima cobrança à frente) → até a próxima cobrança, como sempre", async () => {
    const prox = Date.now() + 20 * DIA;
    const sb = supabaseFalso();
    await tratarHotmart(evento({ recurrence_number: 7, date_next_charge: prox }), () => sb.cliente as never);
    expect(fim(sb)).toBe(new Date(prox).toISOString());
  });
  it("R2 · primeira cobrança sem data → 30 dias, como sempre", async () => {
    const sb = supabaseFalso();
    await tratarHotmart(evento({ recurrence_number: 1 }), () => sb.cliente as never);
    expect(perto(fim(sb), Date.now() + 30 * DIA)).toBe(true);
  });
  it.each([
    ["recorrência antiga sem próxima cobrança à frente", { recurrence_number: 3, date_next_charge: Date.now() - 40 * DIA }, "S9"],
    ["recorrência antiga sem data nenhuma", { recurrence_number: 3 }, "S9"],
    ["pagamento sem assinatura ligada", { recurrence_number: 3, date_next_charge: Date.now() + 20 * DIA }, null],
    ["pagamento sem número de recorrência e sem data", {}, "S9"],
  ])("R3 · %s → não libera 30 dias sozinho; fica na lista do admin", async (_nome, compra, sub) => {
    const sb = supabaseFalso();
    const r = await tratarHotmart(evento(compra, sub), () => sb.cliente as never);
    expect(await r.json()).toEqual({ status: "ok", acesso: "sem_prazo_comprovado" });
    expect(sb.chamadas).not.toContain("rpc.hotmart_acesso_aplicar");
    expect(sb.gravados.find((g) => g.tabela === "unlinked_purchases")?.linha.event_type).toBe("PURCHASE_APPROVED:SEM_PRAZO_COMPROVADO");
  });
  it("R4 · antes da migração do Gerar Pix (tabela ainda não existe) → compra normal segue igual", async () => {
    const sb = supabaseFalso({ semTabelaDeNegociacoes: true });
    const r = await tratarHotmart(evento({ recurrence_number: 2, date_next_charge: Date.now() + 20 * DIA }), () => sb.cliente as never);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(sb.chamadas).toContain("rpc.hotmart_acesso_aplicar");
  });
});
