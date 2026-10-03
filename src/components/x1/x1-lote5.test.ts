import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { chamadaCinturao, provocacoesRestantes, type Cinturao, type Provocacao } from "./x1-lote5";

const campeao = { user_id: "a", nome: "Mohamed", avatar_url: null, dias: 6, defesas: 4, vitorias: 15, patente: "LENDA", sou_eu: false };
const base: Cinturao = { cidade: "São Paulo", uf: "SP", campeao: null, linha: [] };

describe("chamadaCinturao", () => {
  it("invites to take an empty belt", () => {
    expect(chamadaCinturao(base)).toContain("O primeiro X1 que você vencer");
  });
  it("tells the challenger how to take it", () => {
    expect(chamadaCinturao({ ...base, campeao })).toBe("Vence ele no dia e o cinturão é seu.");
  });
  it("counts the champion's defenses", () => {
    expect(chamadaCinturao({ ...base, campeao: { ...campeao, sou_eu: true } })).toContain("defendeu 4 vezes");
  });
});

describe("provocacoesRestantes", () => {
  const p = (minha: boolean): Provocacao => ({ id: 1, user_id: "x", nome: "Zeck", avatar_url: null, frase: "Isso é tudo?", criado_em: "2026-10-03T20:00:00Z", minha });
  it("only my own taunts count against the limit of 3", () => {
    expect(provocacoesRestantes([p(true), p(false), p(false)])).toBe(2);
    expect(provocacoesRestantes([p(true), p(true), p(true), p(true)])).toBe(0);
  });
});
