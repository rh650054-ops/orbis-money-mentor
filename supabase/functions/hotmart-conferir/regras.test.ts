// @vitest-environment node
import { describe, expect, it } from "vitest";
import { oQueCancelar, type AssinaturaUsuario } from "./regras";

const a = (subscription_id: string, user_id: string, oferta_codigo: string, plano: string, recorrencia_n = 1, aprovado_em = "2026-10-01"): AssinaturaUsuario =>
  ({ subscription_id, user_id, oferta_codigo, plano, recorrencia_n, aprovado_em });

describe("hotmart-conferir: o que cancelar", () => {
  it("upgrade pro Pro: cancela o padrão, mantém o Pro e o banco extra", () => {
    expect(oQueCancelar([
      a("SYO7VGK6", "u1", "8qbxvm9p", "Membro Fundador", 4),
      a("RVDNGUXD", "u1", "5y86n311", "Vant Pro"),
      a("BX1", "u1", "3nnrr1xn", "Banco extra"),
    ])).toEqual([{ subscription_id: "SYO7VGK6", user_id: "u1", motivo: "upgrade_pro", manter: "RVDNGUXD" }]);
  });
  it("Pro de oferta nova (só pelo nome) também conta como Pro", () => {
    expect(oQueCancelar([a("I3P7MU72", "u2", "8qbxvm9p", "Membro Fundador"), a("IBQSS8SZ", "u2", "zz999", "Vant Pro")]))
      .toEqual([{ subscription_id: "I3P7MU72", user_id: "u2", motivo: "upgrade_pro", manter: "IBQSS8SZ" }]);
  });
  it("duplicada do mesmo plano: fica a com mais cobranças, sai a outra", () => {
    expect(oQueCancelar([a("UAP8TYZH", "u3", "8qbxvm9p", "Membro Fundador", 2), a("F724WXRA", "u3", "8qbxvm9p", "Membro Fundador", 3)]))
      .toEqual([{ subscription_id: "UAP8TYZH", user_id: "u3", motivo: "duplicada", manter: "F724WXRA" }]);
  });
  it("uma assinatura só, dois Pro, ou planos diferentes sem Pro: não mexe", () => {
    expect(oQueCancelar([a("X", "u4", "8qbxvm9p", "Membro Fundador")])).toEqual([]);
    expect(oQueCancelar([a("P1", "u5", "5y86n311", "Vant Pro"), a("P2", "u5", "ew11enu0", "VANT Pro Anual"), a("M", "u5", "8qbxvm9p", "Membro Fundador")])).toEqual([]);
    expect(oQueCancelar([a("E1", "u6", "aaa", "Essencial"), a("M1", "u6", "8qbxvm9p", "Membro Fundador")])).toEqual([]);
  });
});
