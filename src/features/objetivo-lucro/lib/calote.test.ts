import { describe, expect, it } from "vitest";
import { baseSchema } from "../types";
import { baseComCalote } from "./calote";

const b = baseSchema.parse({
  ticket: 17.8, custo_unid: 8.86, custo_receita: 5.68, calote_unid: 3.18, fonte_custo: "receita", banco: true,
  calote: { valor: 788, recuperado: 250, perdido: 538, estimado_banco: 2451.48, app_pix: 16783.5, usado: 2451.48, fonte: "banco", por_dia: 90.8,
    pct_pix: 19.2, desde: "2026-09-09", dias_banco: 27, app_pix_banco: 12798.5, banco_recebido: 10347.02, teto: 400,
    banco_unid: 3.18, banco_por_dia: 90.8, app_unid: 0.54, app_por_dia: 14.54, tabela: [] },
});

describe("calote source chosen by the seller", () => {
  it("switching to the app's own record recomputes cost per unit and the calote block", () => {
    const a = baseComCalote(b, "app");
    expect(a.calote_unid).toBe(0.54);
    expect(a.custo_unid).toBe(6.22); // 5.68 + 0.54
    expect(a.calote.fonte).toBe("app");
    expect(a.calote.usado).toBe(538);
    expect(a.calote.por_dia).toBe(14.54);
    expect(a.calote.pct_pix).toBe(3.2);
  });
  it("same source → same object; bank not available → stays as it is", () => {
    expect(baseComCalote(b, "banco")).toBe(b);
    const semBanco = { ...b, calote: { ...b.calote, fonte: "app" as const, estimado_banco: null, banco_unid: null } };
    expect(baseComCalote(semBanco, "banco")).toBe(semBanco);
  });
});
