// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cancelarNaHotmart, padroesParaCancelar } from "./cancelar-padrao";

describe("upgrade pro Pro cancela o plano padrão", () => {
  it("só o padrão: nem o Pro que entrou, nem outro Pro, nem banco extra", () => {
    expect(padroesParaCancelar([
      { subscription_id: "OJ56N5VN", oferta_codigo: "8qbxvm9p" },
      { subscription_id: "BR6F9LHV", oferta_codigo: "t9xt3k4z" },
      { subscription_id: "BANCO1", oferta_codigo: "3nnrr1xn" },
    ], "BR6F9LHV")).toEqual(["OJ56N5VN"]);
  });
  it("Pro com oferta nova (só pelo nome do plano) nunca é cancelado", () => {
    expect(padroesParaCancelar([
      { subscription_id: "I3P7MU72", oferta_codigo: "8qbxvm9p", plano: "Membro Fundador" },
      { subscription_id: "IBQSS8SZ", oferta_codigo: "ckkw1xkf", plano: "Vant Pro" },
      { subscription_id: "NOVO1", oferta_codigo: "zzz99999", plano: "VANT Pro Anual" },
    ], "XJ04BBBO")).toEqual(["I3P7MU72"]);
  });
  it("sem credenciais não chama a Hotmart e devolve pra cancelar na mão", async () => {
    const busca = vi.fn();
    const r = await cancelarNaHotmart(["OJ56N5VN"], () => undefined, busca as unknown as typeof fetch);
    expect(busca).not.toHaveBeenCalled();
    expect(r.naMao).toEqual(["OJ56N5VN"]);
  });
  it("com credenciais: token e cancelamento com e-mail pro cliente", async () => {
    const busca = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tk" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const env = (k: string) => ({ HOTMART_CLIENT_ID: "a", HOTMART_CLIENT_SECRET: "b", HOTMART_BASIC: "c" } as Record<string, string>)[k];
    const r = await cancelarNaHotmart(["OJ56N5VN"], env, busca as unknown as typeof fetch);
    expect(r.cancelados).toEqual(["OJ56N5VN"]);
    expect(JSON.parse(busca.mock.calls[1]![1].body)).toEqual({ subscriber_code: ["OJ56N5VN"], send_mail: true });
  });
});
