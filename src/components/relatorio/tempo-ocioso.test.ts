import { describe, expect, it } from "vitest";
import { minutosOciosos, segundosDePausa } from "./tempo-ocioso";

const s = (o: Partial<Parameters<typeof minutosOciosos>[0]> = {}) => ({
  id: "s1", started_at: "2026-10-07T17:30:00Z", ended_at: "2026-10-08T00:12:00Z", worked_minutes: 233, paused_seconds: 193 * 60, ...o,
});

describe("tempo ocioso", () => {
  it("usa as pausas registradas, não o contador que contava duas vezes", () => {
    const pausas = [
      { session_id: "s1", inicio: "2026-10-07T18:26:00Z", fim: "2026-10-07T18:40:00Z", segundos: 840 },
      { session_id: "s1", inicio: "2026-10-07T18:57:00Z", fim: "2026-10-07T19:46:00Z", segundos: 2940 },
    ];
    expect(minutosOciosos(s(), pausas)).toBe(63);
  });

  it("pausa repetida ou sobreposta conta uma vez só", () => {
    const fim = Date.parse("2026-10-08T00:00:00Z");
    expect(segundosDePausa([
      { session_id: "s1", inicio: "2026-10-07T23:13:00Z", fim: "2026-10-07T23:13:00Z", segundos: 0 },
      { session_id: "s1", inicio: "2026-10-07T23:13:00Z", fim: "2026-10-08T00:11:00Z", segundos: 3480 },
      { session_id: "s1", inicio: "2026-10-07T23:30:00Z", fim: "2026-10-07T23:40:00Z", segundos: 600 },
    ], fim)).toBe(47 * 60);
  });

  it("sessão antiga sem pausas registradas: contador antigo, com teto no tempo não trabalhado", () => {
    // parede 402 min − 233 trabalhados = 169 de teto
    expect(minutosOciosos(s(), [])).toBe(169);
  });
});
