// @vitest-environment node
/* Pagamento aprovado NUNCA pode virar "concluído" se a assinatura não gravou:
   a falha devolve 500 e libera o evento, e o reenvio da Hotmart é processado. */
import { beforeAll, describe, expect, it, vi } from "vitest";

type Resultado = { data: unknown; error: { message: string; code?: string } | null };

function supabaseFalso(opts: { falhar?: Set<string>; achar?: string | null; perfis?: Set<string> } = {}) {
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
    const q = {
      insert(v: Record<string, unknown>) { op = "insert"; linha = v; return q; },
      upsert(v: Record<string, unknown>) { op = "upsert"; linha = v; return q; },
      update(v: Record<string, unknown>) { op = "update"; linha = v; return q; },
      delete() { op = "delete"; return q; },
      select() { return q; },
      eq(col: string, v: unknown) {
        if (col === "event_id") linha = { event_id: v };
        if (col === "user_id") filtroUser = v;
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
    rpc: (nome: string) => {
      chamadas.push(`rpc.${nome}`);
      if (falhar.has(`rpc.${nome}`)) return Promise.resolve({ data: null, error: { message: "falhou" } });
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
        purchase: { transaction: "T1", offer: { code: offer }, ...(xcod ? { origin: { xcod } } : {}) },
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

describe("hotmart-webhook: recebido ≠ concluído", () => {
  it("assinatura não gravou → 500, evento liberado, e o reenvio da Hotmart ativa a assinatura", async () => {
    const sb = supabaseFalso({ falhar: new Set(["subscriptions.upsert"]) });
    const r1 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r1.status).toBe(500);
    expect(sb.marcados.size).toBe(0); // não ficou "processado"
    expect(sb.chamadas).not.toContain("profiles.update");

    sb.falhar.clear(); // Hotmart reenvia, banco voltou
    const r2 = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ status: "ok" });
    expect(sb.marcados.size).toBe(1);
    expect(sb.chamadas.filter((c) => c === "subscriptions.upsert")).toHaveLength(2);
  });

  it("perfil não gravou → também libera pra reenvio", async () => {
    const sb = supabaseFalso({ falhar: new Set(["profiles.update"]) });
    const r = await tratarHotmart(pedido(), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
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
    expect(sb.chamadas.filter((c) => c === "subscriptions.upsert")).toHaveLength(1);
  });

  it("cancelamento que não gravou → libera pra reenvio (não deixa acesso aberto)", async () => {
    const sb = supabaseFalso({ falhar: new Set(["subscriptions.upsert"]) });
    const r = await tratarHotmart(pedido("8qbxvm9p", "SUBSCRIPTION_CANCELLATION"), () => sb.cliente as never);
    expect(r.status).toBe(500);
    expect(sb.marcados.size).toBe(0);
  });
});

describe("hotmart-webhook: fallback pelo xcod", () => {
  const UID = "3f2b8c1e-9a7d-4e21-b6c3-0d5e4f6a7b8c";
  const assinaturaDe = (sb: ReturnType<typeof supabaseFalso>) =>
    sb.gravados.find((g) => g.tabela === "subscriptions" && g.op === "upsert")?.linha;

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
