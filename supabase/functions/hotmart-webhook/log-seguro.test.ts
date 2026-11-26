// @vitest-environment node
/* The function logs of hotmart-webhook must not carry the buyer's personal data (26/11/2026).
   Part 1: the helper. Part 2: the real handler, every path, with a payload full of personal data. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { codigo, linhaDoEvento, semContato } from "./log-seguro";

describe("log-seguro: the helper", () => {
  it("a code keeps only letters, digits and - _ . :", () => {
    expect(codigo("HP0123456789")).toBe("HP0123456789");
    expect(codigo("  AB-12_cd.9:x ")).toBe("AB-12_cd.9:x");
    expect(codigo("fulana@exemplo.com")).toBe("fulanaexemplo.com".replace("@", ""));
    expect(codigo("Maria de Souza")).toBe("MariadeSouza");
    expect(codigo("")).toBeNull();
    expect(codigo(null)).toBeNull();
    expect(codigo("x".repeat(200))).toHaveLength(80);
  });
  it("the receipt line has the five identifiers and nothing else", () => {
    const linha = JSON.parse(linhaDoEvento({ evento: "PURCHASE_APPROVED", id: "ev-1", transacao: "HP1", assinatura: "SUB1", oferta: "8qbxvm9p", ...({ buyer: "x" } as object) }));
    expect(linha).toEqual({ evento: "PURCHASE_APPROVED", id: "ev-1", transacao: "HP1", assinatura: "SUB1", oferta: "8qbxvm9p" });
  });
  it("free text: e-mail, CPF, CNPJ and phone are masked", () => {
    const t = semContato('Key (buyer_email)=(Maria.Souza@Exemplo.com.br) cpf 123.456.789-09 ou 12345678909, cnpj 12.345.678/0001-95, tel (11) 98765-4321 e +55 11 987654321');
    expect(t).not.toMatch(/exemplo|123\.456|12345678909|0001-95|98765|987654321/i);
    expect(t).toContain("[EMAIL]");
    expect(t).toContain("[CPF]");
    expect(t).toContain("[CNPJ]");
    expect(t).toContain("[TELEFONE]");
  });
  it("free text: our account id (UUID) is kept, even when it is all digits", () => {
    const id = "12345678-1234-1234-1234-123456789012";
    expect(semContato(`hotmart_acesso_aplicar: user ${id} not found`)).toBe(`hotmart_acesso_aplicar: user ${id} not found`);
    expect(semContato(`a ${id} b fulana@exemplo.com c ${id}`)).toBe(`a ${id} b [EMAIL] c ${id}`);
  });
  it("free text: cut at the limit, and never throws on odd input", () => {
    expect(semContato("a".repeat(1000), 50)).toHaveLength(50);
    expect(semContato(undefined)).toBe("");
    expect(semContato(new Error("falhou"))).toBe("Error: falhou");
  });
});

// ---------- the real handler ----------
const NOME = "Maria Aparecida de Souza";
const EMAIL = "maria.aparecida@exemplo.com.br";
const CPF_PONTUADO = "123.456.789-09";
const CPF = "12345678909";
const FONE = "11987654321";
const RUA = "Rua das Palmeiras";
const CEP = "06700123";
const PROIBIDO = [NOME, "Maria", "Aparecida", "Souza", EMAIL, "exemplo.com", CPF_PONTUADO, CPF, FONE, "98765", RUA, "Palmeiras", CEP, "Cotia"];

type R = { data: unknown; error: { message: string; code?: string } | null };
function supabaseFalso(respostas: Record<string, R> = {}) {
  const marcados = new Set<string>();
  const chamadas: string[] = [];
  const tabela = (t: string) => {
    let op = "select";
    let evento = "";
    const q = {
      insert(v: Record<string, unknown>) { op = "insert"; evento = String(v.event_id ?? ""); return q; },
      upsert() { op = "upsert"; return q; },
      update() { op = "update"; return q; },
      delete() { op = "delete"; return q; },
      select() { return q; },
      eq(col: string, v: unknown) { if (col === "event_id") evento = String(v); return q; },
      ilike() { return q; },
      is() { return q; },
      maybeSingle() { return q; },
      then(res: (r: R) => unknown, rej?: (e: unknown) => unknown) {
        const k = `${t}.${op}`;
        chamadas.push(k);
        let r: R = respostas[k] ?? { data: null, error: null };
        if (t === "processed_hotmart_events" && op === "insert" && !respostas[k]) {
          if (marcados.has(evento)) r = { data: null, error: { message: "dup", code: "23505" } };
          else marcados.add(evento);
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
      return Promise.resolve(respostas[`rpc.${nome}`] ?? { data: nome === "orbis_achar_usuario" ? "11111111-2222-3333-4444-555555555555" : true, error: null });
    },
  };
  return { cliente, chamadas };
}

const corpo = (event: string, offer: string, extra: Record<string, unknown> = {}) => ({
  id: `ev-${event}-${offer}`,
  event,
  creation_date: 1795700000000,
  data: {
    buyer: {
      name: NOME, email: EMAIL, document: CPF_PONTUADO, checkout_phone: FONE,
      address: { address: RUA, zipcode: CEP, city: "Cotia", state: "SP", country: "Brasil" },
    },
    purchase: { transaction: "HP0000TESTE1", status: "APPROVED", offer: { code: offer }, price: { value: 29.9, currency_value: "BRL" } },
    subscription: { subscriber: { code: "SUBTESTE1" }, plan: { name: "Membro Fundador" } },
    ...extra,
  },
});
const pedido = (body: unknown, hottok = "segredo-teste") =>
  new Request("https://x/hotmart-webhook", {
    method: "POST",
    headers: { "x-hotmart-hottok": hottok, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

let tratarHotmart: (req: Request, criar: () => never) => Promise<Response>;
const linhas: string[] = [];
const guardar = (...a: unknown[]) => { linhas.push(a.map((x) => (typeof x === "string" ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(" ")); };

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(guardar);
  vi.spyOn(console, "error").mockImplementation(guardar);
  vi.spyOn(console, "warn").mockImplementation(guardar);
  vi.spyOn(console, "info").mockImplementation(guardar);
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (k: string) => (k === "HOTMART_HOTTOK" ? "segredo-teste" : undefined) },
    serve: () => {},
  };
  ({ tratarHotmart } = (await import("./index")) as unknown as { tratarHotmart: typeof tratarHotmart });
});
beforeEach(() => { linhas.length = 0; });

const semDadoPessoal = () => {
  const tudo = linhas.join("\n");
  for (const p of PROIBIDO) expect(tudo, `log carries "${p}"`).not.toContain(p);
  expect(tudo).not.toMatch(/@/);
};
const rodar = async (body: unknown, respostas: Record<string, R> = {}) => {
  const sb = supabaseFalso(respostas);
  const r = await tratarHotmart(pedido(body), () => sb.cliente as never);
  return { r, sb, tudo: linhas.join("\n") };
};

describe("hotmart-webhook: no personal data in the logs, on every path", () => {
  it("approved purchase: receipt line has event, event id, transaction, subscription and offer", async () => {
    const { r, sb, tudo } = await rodar(corpo("PURCHASE_APPROVED", "8qbxvm9p"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(sb.chamadas).toContain("rpc.hotmart_acesso_aplicar");
    semDadoPessoal();
    const recibo = linhas.find((l) => l.startsWith("hotmart-webhook: event received"))!;
    expect(JSON.parse(recibo.slice(recibo.indexOf("{")))).toEqual({
      evento: "PURCHASE_APPROVED", id: "ev-PURCHASE_APPROVED-8qbxvm9p", transacao: "HP0000TESTE1", assinatura: "SUBTESTE1", oferta: "8qbxvm9p",
    });
    expect(tudo).toContain("11111111-2222-3333-4444-555555555555");
  });

  it("the whole event still goes to the audit table (hotmart_eventos), untouched", async () => {
    const { sb } = await rodar(corpo("PURCHASE_APPROVED", "8qbxvm9p"));
    expect(sb.chamadas).toContain("hotmart_eventos.insert");
  });

  it("renewal, cancellation, refund, chargeback, delayed and protest", async () => {
    for (const ev of ["SUBSCRIPTION_RENEWAL", "PURCHASE_COMPLETE", "SUBSCRIPTION_CANCELLATION", "PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_DELAYED", "PURCHASE_PROTEST"]) {
      const { r } = await rodar(corpo(ev, "8qbxvm9p"));
      expect(r.status, ev).toBe(200);
    }
    semDadoPessoal();
    expect(linhas.filter((l) => l.startsWith("hotmart-webhook: event received"))).toHaveLength(7);
  });

  it("buyer not found → unlinked purchase", async () => {
    const { r } = await rodar(corpo("PURCHASE_APPROVED", "8qbxvm9p"), { "rpc.orbis_achar_usuario": { data: null, error: null } });
    expect(await r.json()).toEqual({ status: "unlinked" });
    semDadoPessoal();
  });

  it("extra bank, buyer not found: the warning names the transaction, not the e-mail", async () => {
    const { r, tudo } = await rodar(corpo("PURCHASE_APPROVED", "3nnrr1xn"), { "rpc.orbis_achar_usuario": { data: null, error: null } });
    expect(await r.json()).toEqual({ status: "banco_extra_sem_dono" });
    semDadoPessoal();
    const aviso = linhas.find((l) => l.includes("comprador não identificado"))!;
    expect(aviso).toContain('"transacao":"HP0000TESTE1"');
    expect(aviso).toContain('"assinatura":"SUBTESTE1"');
    expect(tudo).not.toContain("undefined");
  });

  it("extra bank in an expired account: the alarm names account, transaction and subscription, not CPF/e-mail", async () => {
    const { r } = await rodar(corpo("PURCHASE_APPROVED", "3nnrr1xn"), {
      "rpc.orbis_pro_ativo": { data: false, error: null },
      "profiles.select": { data: { plan_status: "expired", billing_exempt: false }, error: null },
    });
    expect(await r.json()).toEqual({ status: "banco_extra_ok" });
    semDadoPessoal();
    const alarme = linhas.find((l) => l.startsWith("BANCO_EXTRA_EM_CONTA_EXPIRADA"))!;
    expect(alarme).toContain("user=11111111-2222-3333-4444-555555555555");
    expect(alarme).toContain("transacao=HP0000TESTE1");
    expect(alarme).toContain("assinatura=SUBTESTE1");
    expect(alarme).not.toMatch(/cpf=|email=/);
  });

  it("a database error that quotes the buyer's data is masked before it is logged", async () => {
    const vazando = { data: null, error: { message: `duplicate key: Key (buyer_email, buyer_cpf)=(${EMAIL}, ${CPF}) already exists; phone ${FONE}` } };
    const { r } = await rodar(corpo("PURCHASE_APPROVED", "8qbxvm9p"), { "rpc.hotmart_acesso_aplicar": vazando, "rpc.orbis_achar_usuario": { data: "11111111-2222-3333-4444-555555555555", error: { message: `no row for ${EMAIL}` } } });
    expect(r.status).toBe(500);
    semDadoPessoal();
    expect(linhas.join("\n")).toContain("[EMAIL]");
  });

  it("a body that is not JSON: the parser's message (which may quote the body) is masked", async () => {
    const sb = supabaseFalso();
    const r = await tratarHotmart(pedido(`${EMAIL} ${CPF_PONTUADO} ${NOME}`), () => sb.cliente as never);
    expect(r.status).toBe(500);
    const tudo = linhas.join("\n");
    expect(tudo).not.toContain(EMAIL);
    expect(tudo).not.toContain(CPF_PONTUADO);
  });

  it("repeated event and wrong token: nothing personal either", async () => {
    const sb = supabaseFalso();
    await tratarHotmart(pedido(corpo("PURCHASE_APPROVED", "8qbxvm9p")), () => sb.cliente as never);
    const dup = await tratarHotmart(pedido(corpo("PURCHASE_APPROVED", "8qbxvm9p")), () => sb.cliente as never);
    expect(await dup.json()).toEqual({ status: "duplicate" });
    const recusado = await tratarHotmart(pedido(corpo("PURCHASE_APPROVED", "8qbxvm9p"), "errado"), () => sb.cliente as never);
    expect(recusado.status).toBe(401);
    semDadoPessoal();
  });
});

describe("hotmart-webhook: the source keeps it that way", () => {
  const fonte = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
  const logs = fonte.split("\n").filter((l) => /console\.(log|error|warn|info|debug)\(/.test(l));
  it("no log line names the buyer's fields or prints the payload", () => {
    expect(logs.length).toBeGreaterThan(15);
    for (const l of logs) {
      expect(l, l.trim()).not.toMatch(/buyerEmail|buyerCpf|buyerDoc|buyerNome|afiliadoNome|payload\)|JSON\.stringify\(payload/);
    }
  });
  it("every free-text error that is logged goes through semContato", () => {
    for (const l of logs) {
      if (/\.message|String\(e\)|String\(error\)|, e\)|, error\)/.test(l)) expect(l, l.trim()).toMatch(/semContato\(/);
    }
  });
});
