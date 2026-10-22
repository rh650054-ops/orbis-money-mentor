import { describe, expect, it } from "vitest";
import { CONECTORES_FORA, filtrarConectores } from "../../supabase/functions/pluggy-connect-token/conectores";

describe("filtrarConectores", () => {
  it("drops the direct Inter (QR code) and keeps the Open Finance one", () => {
    const ids = filtrarConectores([{ id: 215, name: "Inter" }, { id: 823, name: "Inter" }, { id: 212, name: "Nubank" }]);
    expect(ids).toEqual([823, 212]);
    expect(CONECTORES_FORA.has(215)).toBe(true);
  });
  it("returns null when Pluggy sent nothing usable, so the widget opens unfiltered", () => {
    expect(filtrarConectores(undefined)).toBeNull();
    expect(filtrarConectores([])).toBeNull();
    expect(filtrarConectores([{ id: 215 }])).toBeNull();
  });
});
