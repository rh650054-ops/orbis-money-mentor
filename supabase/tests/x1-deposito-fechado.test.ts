// @vitest-environment node
/* The two X1-only deposit edge functions answer "closed" (410) to any call,
   logged in or not, with any amount. mp-webhook is shared and stays untouched. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Handler = (req: Request) => Response | Promise<Response>;
const handlers: Record<string, Handler> = {};

beforeAll(async () => {
  let atual: Handler | null = null;
  vi.stubGlobal("Deno", { serve: (h: Handler) => { atual = h; } });
  for (const nome of ["mp-criar-deposito", "verificar-deposito"]) {
    vi.resetModules();
    await import(`../functions/${nome}/index.ts`);
    handlers[nome] = atual!;
  }
});
afterAll(() => { vi.unstubAllGlobals(); });

describe.each(["mp-criar-deposito", "verificar-deposito"])("%s", (nome) => {
  it("recusa depósito novo com 410 e explica", async () => {
    const r = await handlers[nome]!(new Request("https://x/fn", {
      method: "POST", headers: { Authorization: "Bearer qualquer", "Content-Type": "application/json" },
      body: JSON.stringify({ valor: 50 }),
    }));
    expect(r.status).toBe(410);
    const j = await r.json();
    expect(j.error).toBe("x1_so_pontos");
    expect(j.dica).toMatch(/só pontos/);
  });

  it("não quebra o preflight do navegador (CORS)", async () => {
    const r = await handlers[nome]!(new Request("https://x/fn", { method: "OPTIONS" }));
    expect(r.status).toBe(200);
  });
});
