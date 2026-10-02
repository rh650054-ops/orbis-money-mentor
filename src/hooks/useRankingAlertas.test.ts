import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { agruparAlertas, textoGrupo, type RankingAlerta } from "./useRankingAlertas";

const ev = (id: string, tipo: RankingAlerta["tipo"], nome: string, antes: number, depois: number, min: number): RankingAlerta => ({
  id, tipo, outro_user_id: "u-" + id, outro_nome: nome, outro_avatar: null, posicao_antes: antes, posicao_depois: depois,
  created_at: new Date(Date.UTC(2026, 9, 2, 12, min)).toISOString(),
});

describe("agruparAlertas", () => {
  it("three overtakes in a row become ONE card: #2 → #5", () => {
    // list arrives newest first, like the query
    const lista = [ev("c", "foi_ultrapassado", "João Silva", 4, 5, 3), ev("b", "foi_ultrapassado", "Ana", 3, 4, 2), ev("a", "foi_ultrapassado", "Gabriel", 2, 3, 1)];
    const g = agruparAlertas(lista);
    expect(g).toHaveLength(1);
    expect(g[0]!.ids).toEqual(["c", "b", "a"]);
    expect(g[0]!.posicao_antes).toBe(2);
    expect(g[0]!.posicao_depois).toBe(5);
    expect(textoGrupo(g[0]!)).toEqual({ titulo: "João, Ana e +1 te passaram", corpo: "Você caiu de #2 pra #5. Uma venda a mais e você volta." });
  });
  it("one card per direction, dedupes repeated names", () => {
    const lista = [ev("d", "ultrapassou", "Ana", 6, 5, 4), ev("c", "foi_ultrapassado", "Ana", 5, 6, 3), ev("b", "foi_ultrapassado", "Ana", 4, 5, 2)];
    const g = agruparAlertas(lista);
    expect(g.map((x) => x.tipo)).toEqual(["foi_ultrapassado", "ultrapassou"]);
    expect(g[0]!.nomes).toEqual(["Ana"]);
    expect(textoGrupo(g[0]!).titulo).toBe("Ana te ultrapassou");
    expect(textoGrupo(g[1]!)).toEqual({ titulo: "Você passou Ana", corpo: "De #6 pra #5 do mês." });
  });
  it("two names read naturally", () => {
    const g = agruparAlertas([ev("b", "foi_ultrapassado", "Ana", 3, 4, 2), ev("a", "foi_ultrapassado", "Gabriel", 2, 3, 1)]);
    expect(textoGrupo(g[0]!).titulo).toBe("Ana e Gabriel te passaram");
  });
});
