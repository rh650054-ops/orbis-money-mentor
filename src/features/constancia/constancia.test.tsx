/* Chama da constância (Rick, 05/11): the chip, the end-of-day numbers, the state banner, the milestones. */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { constanciaSchema, type Constancia } from "./types";
import { marcoAnterior, proximoMarco } from "./lib/marcos";
import { fimDoDiaPendente, limparFimDoDia, marcarFimDoDia } from "./lib/fim-do-dia";
import { lookDoEstado } from "./components/chama-icone";
import { numerosDoDia } from "./components/fim-do-dia";
import { textoDoEstado } from "./components/constancia-painel";

const base = (x: Partial<Constancia> = {}): Constancia => constanciaSchema.parse({
  dias: 23, recorde: 41, estado: "acesa", faltas: 0, guardados: 0, resgate: 0, hoje_trabalhou: true, hoje_trabalha: true,
  antes: { dias: 22, estado: "acesa", resgate: 0, guardados: 0 }, mes: [], ...x,
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({ supabase: { rpc: async () => ({ data: null, error: null }) }, createQueryKeys: (f: string) => ({ all: [f], detail: (id: string) => [f, "detail", id] }) }));
vi.mock("./api/use-constancia", () => ({
  useConstanciaQuery: () => ({ data: { dias: 23, recorde: 41, recorde_fim: null, estado: "congelada", faltas: 1, guardados: 0, resgate: 0, ultimo_trabalho: null, hoje_trabalhou: false, hoje_trabalha: true, antes: { dias: 22, estado: "acesa", resgate: 0, guardados: 0 }, mes: [] } }),
  useAtualizarConstancia: () => () => {},
}));
import { ChamaTopo } from "./components/chama-topo";

describe("chama da constância", () => {
  it("the chip shows the streak and the ice when frozen", () => {
    render(<ChamaTopo userId="u1" />);
    const b = screen.getByRole("button", { name: /Chama da constância: 23 dias, congelada/ });
    expect(b.textContent).toContain("23");
  });

  it("looks: frozen and lost = ice, never = grey, lit = gold", () => {
    expect(lookDoEstado("congelada", 5)).toBe("gelo");
    expect(lookDoEstado("perdeu", 0)).toBe("gelo");
    expect(lookDoEstado("nunca", 0)).toBe("apagada");
    expect(lookDoEstado("acesa", 3)).toBe("acesa");
    expect(lookDoEstado("resgate", 0)).toBe("acesa");
  });

  it("end of day: old → new number; ice cracks when it was frozen; rescue counts kept + done", () => {
    expect(numerosDoDia(base())).toEqual({ velho: 22, novo: 23, gelo: false, resgate: false });
    expect(numerosDoDia(base({ antes: { dias: 22, estado: "congelada", resgate: 0, guardados: 0 } })).gelo).toBe(true);
    const r = numerosDoDia(base({ estado: "resgate", dias: 0, guardados: 23, resgate: 3, antes: { dias: 0, estado: "resgate", resgate: 2, guardados: 23 } }));
    expect(r).toEqual({ velho: 25, novo: 26, gelo: false, resgate: true });
  });

  it("the banner says what to do in each state", () => {
    expect(textoDoEstado(base({ estado: "congelada", faltas: 1, hoje_trabalhou: false }))?.texto).toMatch(/não trabalhou um dia.*vende hoje/);
    expect(textoDoEstado(base({ estado: "perdeu", dias: 0, guardados: 23 }))?.texto).toMatch(/tinha 23 dias.*7 dias/);
    expect(textoDoEstado(base({ estado: "resgate", dias: 0, guardados: 23, resgate: 4 }))?.titulo).toBe("Resgate: 4 de 7 dias");
    expect(textoDoEstado(base({ hoje_trabalhou: true }))).toBeNull();
  });

  it("milestones", () => {
    expect(proximoMarco(23)).toBe(30);
    expect(marcoAnterior(23)).toBe(14);
    expect(proximoMarco(0)).toBe(1);
  });

  it("the end-of-day mark is read once and valid for 12h", () => {
    marcarFimDoDia("u1");
    expect(fimDoDiaPendente("u1")).toBe(true);
    expect(fimDoDiaPendente("u1", Date.now() + 13 * 3600_000)).toBe(false);
    limparFimDoDia("u1");
    expect(fimDoDiaPendente("u1")).toBe(false);
  });
});
