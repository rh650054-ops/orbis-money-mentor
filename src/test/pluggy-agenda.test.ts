import { describe, expect, it } from "vitest";
import {
  motivoDeLeitura, deslocamento, relogioBRT, contarLeitura, podePuxarAgora,
  LIMITE_DIA, LIMITE_GLOBAL_DIA, type Contexto,
} from "../../supabase/functions/_shared/pluggy-agenda";

// Brasília = UTC-3. brt("2026-10-08 14:30") → that instant.
const brt = (s: string) => new Date(s.replace(" ", "T") + ":00-03:00");
const UID = "user-teste";

const base = (over: Partial<Contexto>): Contexto => ({
  agora: brt("2026-10-08 14:30"),
  userId: UID,
  ultimaLeitura: null,
  focoAtivo: false,
  focoFimEm: null,
  leiturasHoje: 0,
  leiturasGlobaisHoje: 0,
  ...over,
});

describe("pluggy agenda — when the bank is read", () => {
  it("vendor not selling in the afternoon: no read at all", () => {
    expect(motivoDeLeitura(base({ ultimaLeitura: brt("2026-10-08 09:10") }))).toBeNull();
  });

  it("morning: one read after 08:00 + the vendor's offset, only once", () => {
    const abre = 8 * 60 + deslocamento(UID, 120);
    const h = String(Math.floor(abre / 60)).padStart(2, "0");
    const m = String(abre % 60).padStart(2, "0");
    const naHora = brt(`2026-10-08 ${h}:${m}`);
    expect(motivoDeLeitura(base({ agora: naHora, ultimaLeitura: brt("2026-10-08 01:00") }))).toBe("manha");
    expect(motivoDeLeitura(base({ agora: new Date(naHora.getTime() + 30 * 60_000), ultimaLeitura: naHora }))).toBeNull();
  });

  it("Foco on: reads right away, then once per hour", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 09:00") }))).toBe("foco");
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 14:00") }))).toBeNull();
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 13:29") }))).toBe("foco");
  });

  it("after the Foco: one read soon after the end and one ~1h later, then nothing", () => {
    const fim = brt("2026-10-08 14:00");
    // app's own read didn't happen → the robot covers it
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 14:10"), focoFimEm: fim, ultimaLeitura: brt("2026-10-08 13:30") }))).toBe("pos_foco");
    // app read at 14:01 → nothing until ~1h later
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 14:30"), focoFimEm: fim, ultimaLeitura: brt("2026-10-08 14:01") }))).toBeNull();
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 15:05"), focoFimEm: fim, ultimaLeitura: brt("2026-10-08 14:01") }))).toBe("pos_foco");
    // second read done → quiet until midnight
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 17:00"), focoFimEm: fim, ultimaLeitura: brt("2026-10-08 15:05") }))).toBeNull();
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 21:00"), focoFimEm: fim, ultimaLeitura: brt("2026-10-08 15:05") }))).toBeNull();
  });

  it("closing read after midnight, spread by vendor, once", () => {
    const abre = 5 + deslocamento(UID, 175);
    const instante = new Date(brt("2026-10-09 00:00").getTime() + abre * 60_000);
    expect(motivoDeLeitura(base({ agora: instante, ultimaLeitura: brt("2026-10-08 15:05") }))).toBe("fechamento");
    expect(motivoDeLeitura(base({ agora: new Date(instante.getTime() + 20 * 60_000), ultimaLeitura: instante }))).toBeNull();
  });

  it("TRAVA: never past the daily limit per bank", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, leiturasHoje: LIMITE_DIA }))).toBeNull();
  });

  it("TRAVA: past the global budget only the closing read runs", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, leiturasGlobaisHoje: LIMITE_GLOBAL_DIA }))).toBeNull();
  });

  it("vendors are spread over the window (no single-minute spike)", () => {
    const offs = new Set(Array.from({ length: 200 }, (_, i) => deslocamento(`u-${i}`, 120)));
    expect(offs.size).toBeGreaterThan(60);
  });

  it("Brasília clock and daily counter", () => {
    const r = relogioBRT(brt("2026-10-08 00:30"));
    expect(r.dia).toBe("2026-10-08");
    expect(r.minutoDoDia).toBe(30);
    expect(contarLeitura("2026-10-07", 9, "2026-10-08")).toBe(1);
    expect(contarLeitura("2026-10-08", 3, "2026-10-08")).toBe(4);
  });

  it("'puxar agora' from the app waits 10 min and respects the daily limit", () => {
    const agora = brt("2026-10-08 18:00");
    expect(podePuxarAgora(brt("2026-10-08 17:55"), 2, agora)).toBe(false);
    expect(podePuxarAgora(brt("2026-10-08 17:45"), 2, agora)).toBe(true);
    expect(podePuxarAgora(null, LIMITE_DIA, agora)).toBe(false);
  });
});
