import { describe, expect, it } from "vitest";
import { lerDiagnostico } from "./diagnostico-widget";

const leu = Date.UTC(2026, 10, 28, 11, 5);   // 08:05 in Brazil

describe("widget diagnosis in Minha Conta", () => {
  it("tells each failure apart", () => {
    expect(lerDiagnostico(null).ok).toBe(false);
    expect(lerDiagnostico({ grupo: false, temConta: false }).texto).toMatch(/App Group/);
    expect(lerDiagnostico({ grupo: true, temConta: false }).texto).toMatch(/ainda não foi enviada/);
    expect(lerDiagnostico({ grupo: true, temConta: true }).texto).toMatch(/ainda não leu/);
    expect(lerDiagnostico({ grupo: true, temConta: true, widgetLeuEm: leu, widgetViuConta: false }).texto).toMatch(/08:05 sem a sua conta/);
  });
  it("connected: the widget read this account, with today's DEFCON", () => {
    const d = lerDiagnostico({ grupo: true, temConta: true, widgetLeuEm: leu, widgetViuConta: true, widgetPainelData: "2026-11-28" });
    expect(d).toEqual({ ok: true, texto: "Widget conectado · leu às 08:05 com o DEFCON de hoje." });
  });
});
