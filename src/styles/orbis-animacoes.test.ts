// Trava de regressão (11/10/2026): animação de entrada com fill-mode "both"/"forwards"
// deixa um transform preso no fim. Transform vira o "pai" de todo position:fixed lá
// dentro e as telas cheias (Produtos, quiz, onboarding) somem: altura 0, pretas, sem toque.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "orbis.css"), "utf8");
const regra = (seletor: string) => css.split("\n").find((l) => l.trim().startsWith(seletor)) ?? "";

describe("animações de entrada não prendem transform", () => {
  for (const s of [".orbis-page-enter", ".orbis-page-back", ".orbis-card-in", ".orbis-stagger > *"]) {
    it(`${s} usa fill-mode backwards`, () => {
      const r = regra(s);
      expect(r).toContain("animation:");
      expect(r).toMatch(/\bbackwards\b/);
      expect(r).not.toMatch(/\b(both|forwards)\b/);
    });
  }
});
