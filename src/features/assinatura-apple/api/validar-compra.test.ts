import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/shared/api", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { validarNoServidor } from "./validar-compra";

describe("apple-validar answer", () => {
  it("carries acesso.plano exactly as the server sent it", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, resultados: [{ resultado: "gravada" }], acesso: { plano: false, pro: false } }, error: null });
    expect(await validarNoServidor(["jws"])).toEqual({ tipo: "ok", resultados: [{ resultado: "gravada" }], acesso: { plano: false } });
    invoke.mockResolvedValueOnce({ data: { ok: true, resultados: [{ resultado: "gravada" }], acesso: { plano: true } }, error: null });
    expect(await validarNoServidor(["jws"])).toEqual({ tipo: "ok", resultados: [{ resultado: "gravada" }], acesso: { plano: true } });
  });

  it("no acesso in the answer: nothing invented", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, resultados: [{ resultado: "gravada" }] }, error: null });
    expect(await validarNoServidor(["jws"])).toEqual({ tipo: "ok", resultados: [{ resultado: "gravada" }] });
  });
});
