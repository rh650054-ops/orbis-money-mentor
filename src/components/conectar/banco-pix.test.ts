import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { demoraDoBanco, pixQueEntraNoDia, proximoPedidoDoBanco } from "./banco-pix";

describe("próximo pedido ao banco (Pluggy: 1 por hora)", () => {
  const agora = new Date("2026-10-16T20:37:00Z"); // 17:37 BRT
  it("fechou o Foco 42 min depois do último pedido → avisa que pede de novo às 17:56", () => {
    expect(proximoPedidoDoBanco("2026-10-16T19:55:00Z", agora)).toBe("2026-10-16T20:56:00.000Z");
  });
  it("já passou 1 h → nada a avisar", () => {
    expect(proximoPedidoDoBanco("2026-10-16T19:30:00Z", agora)).toBeNull();
    expect(proximoPedidoDoBanco(null, agora)).toBeNull();
  });
});

describe("bancos lentos", () => {
  it("C6 e Itaú avisam a demora; os rápidos não", () => {
    expect(demoraDoBanco("C6 Bank")).toBe(4);
    expect(demoraDoBanco("Itaú")).toBe(10);
    expect(demoraDoBanco("InfinitePay")).toBeNull();
    expect(demoraDoBanco("Nubank")).toBeNull();
  });
});

describe("Pix que entra no dia", () => {
  it("nunca passa do que foi vendido fora dinheiro e cartão", () => {
    expect(pixQueEntraNoDia(147, 305, 0, 0)).toEqual({ entra: 147, aMais: 0 });
    expect(pixQueEntraNoDia(400, 305, 50, 0)).toEqual({ entra: 255, aMais: 145 });
  });
});
