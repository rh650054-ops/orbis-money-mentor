import { describe, expect, it } from "vitest";
import { pausadasParaDesligar } from "../../supabase/functions/_shared/pluggy-pausa";

describe("lost access → bank paused, removed after 7 days (Rick, 04/11)", () => {
  const agora = new Date("2026-11-12T12:00:00Z");
  it("only connections paused 7+ days ago", () => {
    const c = [
      { id: "a", pausado_em: "2026-11-05T11:00:00Z" },
      { id: "b", pausado_em: "2026-11-06T12:00:00Z" },
      { id: "c", pausado_em: null },
    ];
    expect(pausadasParaDesligar(c, agora).map((x) => x.id)).toEqual(["a"]);
  });
});
