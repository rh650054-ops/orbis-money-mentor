// A1 — from the tap on "Ligar meu banco" until the Pluggy screen opens and answers.
// Everything here is SIMULATED: the token function and the Pluggy widget are stand-ins.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const naLoja = vi.fn(() => false);
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/shared/lib/platform", () => ({ ehAppDaLoja: () => naLoja() }));
vi.mock("@/shared/lib/avisar", () => ({ avisar: { erro: vi.fn(), silencioso: vi.fn() } }));

type Opcoes = Record<string, any>;
type Pluggy = typeof import("./pluggy");
let pluggy: Pluggy;
let abertos: Opcoes[];
let scripts: HTMLScriptElement[];

/** A stand-in for Pluggy's widget. `init` decides what happens when it is opened. */
function instalarWidget(init: (o: Opcoes) => unknown = (o) => o.onOpen?.()) {
  (window as any).PluggyConnect = class {
    o: Opcoes;
    constructor(o: Opcoes) { this.o = o; abertos.push(o); }
    init() { return init(this.o); }
  };
}
const tokenOk = (extra: Record<string, unknown> = {}) => invoke.mockResolvedValue({ data: { ok: true, accessToken: "tok-1", ...extra }, error: null });
const passo = () => new Promise((r) => setTimeout(r, 0));
/** the n-th Pluggy screen that was opened / the n-th script tag that was added */
const w = (n: number): Opcoes => abertos[n]!;
const sc = (n: number): HTMLScriptElement => scripts[n]!;

beforeEach(async () => {
  vi.resetModules();
  invoke.mockReset();
  naLoja.mockReturnValue(false);
  abertos = [];
  scripts = [];
  localStorage.clear();
  delete (window as any).PluggyConnect;
  vi.spyOn(document.head, "appendChild").mockImplementation(((n: Node) => { scripts.push(n as HTMLScriptElement); return n; }) as any);
  pluggy = await import("./pluggy");
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("ligarBanco: opening the Pluggy screen", () => {
  it("first bank: asks for a token, opens the screen and returns the connected item", async () => {
    tokenOk({ connectorIds: [201, 823] });
    instalarWidget();
    const aoAbrir = vi.fn();
    const p = pluggy.ligarBanco(aoAbrir);
    await passo();
    expect(invoke).toHaveBeenCalledWith("pluggy-connect-token", undefined);
    expect(abertos).toHaveLength(1);
    expect(w(0)).toMatchObject({ connectToken: "tok-1", includeSandbox: false, forceOauthInBrowser: false, connectorIds: [201, 823] });
    expect(w(0).updateItem).toBeUndefined();
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    w(0).onSuccess({ item: { id: "item-1" } });
    await expect(p).resolves.toEqual({ itemId: "item-1" });
  });

  it("reauthorising: sends the item to the server and opens the screen on that same item, with no bank list", async () => {
    tokenOk({ connectorIds: [201] });
    instalarWidget();
    const p = pluggy.ligarBanco(undefined, "item-7");
    await passo();
    expect(invoke).toHaveBeenCalledWith("pluggy-connect-token", { body: { itemId: "item-7" } });
    expect(w(0).updateItem).toBe("item-7");
    expect(w(0).connectorIds).toBeUndefined();
    w(0).onSuccess({ item: { id: "item-7" } });
    await expect(p).resolves.toEqual({ itemId: "item-7" });
  });

  it("store app: the bank's OAuth opens in the system browser; on the web it does not", async () => {
    naLoja.mockReturnValue(true);
    tokenOk();
    instalarWidget();
    void pluggy.ligarBanco();
    await passo();
    expect(w(0).forceOauthInBrowser).toBe(true);
  });

  it.each([
    ["precisa_pro", "precisa_pro"],
    ["precisa_banco_extra", "precisa_banco_extra"],
    ["pluggy_nao_configurado", "pluggy_nao_configurado"],
    ["item_nao_encontrado", "banco_nao_encontrado"],
    ["pluggy_auth", "provedor_fora"],
    ["pluggy_token", "provedor_fora"],
    ["algo_novo_que_nao_conhecemos", "provedor_fora"],
  ])("the server refuses with %s: returns %s and never opens the screen", async (codigo, esperado) => {
    invoke.mockResolvedValue({ data: { error: codigo }, error: null });
    instalarWidget();
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: esperado });
    expect(abertos).toHaveLength(0);
  });

  it("session expired (401): says so", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsHttpError", context: { status: 401 } } });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "sem_login" });
  });

  it("A6: plan, ownership or slot could not be checked (503): the existing 'not you, try again' — never 'subscribe' or 'bank gone'", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsHttpError", context: { status: 503 } } });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "provedor_fora" });
    invoke.mockResolvedValue({ data: { error: "consulta_indisponivel" }, error: null });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "provedor_fora" });
  });

  it("server error (500): it is the provider's side, not the vendor's internet", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsHttpError", context: { status: 500 } } });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "provedor_fora" });
  });

  it("the request never reached the server: no internet", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError" } });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "sem_internet" });
  });

  it("the phone is offline: no internet, whatever the error looks like", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    invoke.mockRejectedValue(new Error("Failed to fetch"));
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "sem_internet" });
  });

  it("the server answers without a token: does not open anything", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    instalarWidget();
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "provedor_fora" });
    expect(abertos).toHaveLength(0);
  });

  it("the token takes too long: gives up instead of leaving the button on 'Abrindo…'", async () => {
    vi.useFakeTimers();
    invoke.mockReturnValue(new Promise(() => {}));
    const p = pluggy.ligarBanco();
    await vi.advanceTimersByTimeAsync(45_000);
    await expect(p).resolves.toEqual({ erro: "provedor_fora" });
  });
});

describe("ligarBanco: the Pluggy script", () => {
  it("the script does not download: no internet, and the NEXT tap tries again from scratch", async () => {
    tokenOk();
    const p1 = pluggy.ligarBanco();
    await passo();
    expect(scripts).toHaveLength(1);
    sc(0).dispatchEvent(new Event("error"));
    await expect(p1).resolves.toEqual({ erro: "sem_internet" });

    const p2 = pluggy.ligarBanco();
    await passo();
    expect(scripts).toHaveLength(2); // a new download, not the old failure
    instalarWidget();
    sc(1).dispatchEvent(new Event("load"));
    await passo();
    w(0).onSuccess({ item: { id: "item-2" } });
    await expect(p2).resolves.toEqual({ itemId: "item-2" });
  });

  it("the script downloads broken (no Pluggy inside): fails, and the next tap is not stuck on that failure", async () => {
    tokenOk();
    const p1 = pluggy.ligarBanco();
    await passo();
    sc(0).dispatchEvent(new Event("load")); // loaded, but window.PluggyConnect is not there
    await expect(p1).resolves.toEqual({ erro: "sem_internet" });

    const p2 = pluggy.ligarBanco();
    await passo();
    expect(scripts).toHaveLength(2);
    instalarWidget();
    sc(1).dispatchEvent(new Event("load"));
    await passo();
    w(0).onClose();
    await expect(p2).resolves.toEqual({ erro: "cancelou" });
  });

  it("the script hangs: gives up after 15 seconds", async () => {
    vi.useFakeTimers();
    tokenOk();
    const p = pluggy.ligarBanco();
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(p).resolves.toEqual({ erro: "sem_internet" });
  });

  it("is downloaded once: a second connection reuses it", async () => {
    tokenOk();
    instalarWidget();
    const p1 = pluggy.ligarBanco();
    await passo();
    w(0).onClose();
    await p1;
    const p2 = pluggy.ligarBanco();
    await passo();
    w(1).onClose();
    await p2;
    expect(scripts).toHaveLength(0); // the widget was already there
  });
});

describe("ligarBanco: what the vendor does inside the Pluggy screen", () => {
  it("closes the screen: cancelled, with no error", async () => {
    tokenOk();
    instalarWidget();
    const p = pluggy.ligarBanco();
    await passo();
    w(0).onClose();
    await expect(p).resolves.toEqual({ erro: "cancelou" });
  });

  it("BUG FIXED: the bank refuses once, the vendor tries again in the same screen and succeeds — the success is kept", async () => {
    tokenOk();
    instalarWidget();
    const p = pluggy.ligarBanco();
    await passo();
    w(0).onError({ message: "INVALID_CREDENTIALS" });
    let terminou = false;
    void p.then(() => { terminou = true; });
    await passo();
    expect(terminou).toBe(false); // still open: the vendor is retrying
    w(0).onSuccess({ item: { id: "item-3" } });
    await expect(p).resolves.toEqual({ itemId: "item-3" });
  });

  it("the bank refuses and the vendor closes the screen: not concluded (different from a plain cancel)", async () => {
    tokenOk();
    instalarWidget();
    const p = pluggy.ligarBanco();
    await passo();
    w(0).onError({ message: "SITE_NOT_AVAILABLE" });
    w(0).onClose();
    await expect(p).resolves.toEqual({ erro: "nao_concluiu" });
  });

  it("the screen fails before it ever opens: error right away, button released", async () => {
    tokenOk();
    instalarWidget((o) => { o.onError({ message: "falhou ao carregar" }); return new Promise(() => {}); });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "erro" });
  });

  it("the widget cannot even be built: error, never stuck", async () => {
    tokenOk();
    (window as any).PluggyConnect = class { constructor() { throw new Error("quebrou"); } };
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "erro" });
  });

  it("opening fails asynchronously: error, never stuck", async () => {
    tokenOk();
    instalarWidget(() => Promise.reject(new Error("init falhou")));
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "erro" });
  });

  it("success without an item id is not treated as a connection", async () => {
    tokenOk();
    instalarWidget();
    const p = pluggy.ligarBanco();
    await passo();
    w(0).onSuccess({});
    await expect(p).resolves.toEqual({ erro: "erro" });
  });

  it("an older widget version without onOpen still releases the button when init returns", async () => {
    tokenOk();
    instalarWidget(() => undefined); // never calls onOpen
    const aoAbrir = vi.fn();
    const p = pluggy.ligarBanco(aoAbrir);
    await passo();
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    w(0).onClose();
    await p;
  });
});

describe("ligarBanco: repeated taps and simultaneous requests", () => {
  it("a second tap while the token is being requested: one token, one screen, the second is told it is already open", async () => {
    let soltarToken: (v: unknown) => void = () => {};
    invoke.mockReturnValue(new Promise((r) => { soltarToken = r; }));
    instalarWidget();
    const p1 = pluggy.ligarBanco();
    const p2 = pluggy.ligarBanco();
    const p3 = pluggy.ligarBanco(undefined, "item-7");
    await expect(p2).resolves.toEqual({ erro: "ja_aberto" });
    await expect(p3).resolves.toEqual({ erro: "ja_aberto" });
    expect(invoke).toHaveBeenCalledTimes(1);
    soltarToken({ data: { ok: true, accessToken: "tok-1" }, error: null });
    await passo();
    expect(abertos).toHaveLength(1);
    w(0).onSuccess({ item: { id: "item-1" } });
    await expect(p1).resolves.toEqual({ itemId: "item-1" });
  });

  it("after a failure the button works again", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "pluggy_token" }, error: null });
    await expect(pluggy.ligarBanco()).resolves.toEqual({ erro: "provedor_fora" });
    tokenOk();
    instalarWidget();
    const p = pluggy.ligarBanco();
    await passo();
    w(0).onClose();
    await expect(p).resolves.toEqual({ erro: "cancelou" });
  });

  it("the screen vanished without telling anyone: a new tap is accepted, never a dead button", async () => {
    tokenOk();
    instalarWidget();
    void pluggy.ligarBanco(); // opens and is never closed (the system reloaded the widget away)
    await passo();
    const p2 = pluggy.ligarBanco();
    await passo();
    expect(abertos).toHaveLength(2);
    w(1).onSuccess({ item: { id: "item-4" } });
    await expect(p2).resolves.toEqual({ itemId: "item-4" });
  });
});

describe("coming back from the bank's app", () => {
  it("marks a connection in progress when the screen opens and clears it when it ends", async () => {
    tokenOk();
    instalarWidget();
    expect(pluggy.tentativaPendente()).toBe(false);
    const p = pluggy.ligarBanco();
    await passo();
    expect(pluggy.tentativaPendente()).toBe(true);
    w(0).onClose();
    await p;
    expect(pluggy.tentativaPendente()).toBe(false);
  });

  it("no mark when the screen never opened", async () => {
    invoke.mockResolvedValue({ data: { error: "precisa_pro" }, error: null });
    await pluggy.ligarBanco();
    expect(pluggy.tentativaPendente()).toBe(false);
  });

  it("the mark expires after 15 minutes", async () => {
    tokenOk();
    instalarWidget();
    void pluggy.ligarBanco();
    await passo();
    expect(pluggy.tentativaPendente(Date.now() + 14 * 60_000)).toBe(true);
    expect(pluggy.tentativaPendente(Date.now() + 16 * 60_000)).toBe(false);
    expect(pluggy.tentativaPendente()).toBe(false); // and it was removed
  });
});
