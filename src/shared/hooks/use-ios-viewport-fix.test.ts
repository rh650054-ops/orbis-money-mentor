import { describe, expect, it, vi } from "vitest";
import { ehIOS, recalcularTela } from "./use-ios-viewport-fix";

describe("barra de baixo no iPhone", () => {
  it("reconhece iPhone e iPad, não Android nem Mac de verdade", () => {
    expect(ehIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(ehIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true); // iPad
    expect(ehIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(ehIOS("Mozilla/5.0 (Linux; Android 14; SM-A546E)", 5)).toBe(false);
  });

  it("recalcula a tela sem tirar a pessoa do lugar", () => {
    const scrollTo = vi.fn();
    const win = { scrollX: 0, scrollY: 640, scrollTo } as unknown as Window;
    recalcularTela(win);
    expect(scrollTo).toHaveBeenNthCalledWith(1, 0, 641);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);
  });
});
