import { describe, it, expect, vi, beforeEach } from "vitest";

const loja = vi.hoisted(() => ({ on: false }));
vi.mock("./platform", () => ({ ehAppDaLoja: () => loja.on }));

import { x1SoPontos, apostaVisivel } from "./x1-loja";

describe("x1-loja", () => {
  beforeEach(() => { loja.on = false; });

  it("web: money stays as it is", () => {
    expect(x1SoPontos()).toBe(false);
    expect(apostaVisivel(20)).toBe(20);
    expect(apostaVisivel(Number.NaN)).toBe(0);
  });

  it("store build: every amount shows as zero (points only)", () => {
    loja.on = true;
    expect(x1SoPontos()).toBe(true);
    expect(apostaVisivel(20)).toBe(0);
    expect(apostaVisivel(0)).toBe(0);
  });
});
