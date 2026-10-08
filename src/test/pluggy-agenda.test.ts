import { describe, expect, it } from "vitest";
import {
  motivoDeLeitura, deslocamento, relogioBRT, contarLeitura, podePuxarAgora,
  cotaDeHoje, diasRestantesNoMes, intervaloFocoMin, podePedir, orcamentoDaConexao, contarPedido, diasParaImportar,
  LIMITE_DIA, LIMITE_GLOBAL_DIA, ORCAMENTO_MES, LIMITE_OPEN_FINANCE_MES, type Contexto,
} from "../../supabase/functions/_shared/pluggy-agenda";
import { linhasMudadas } from "../../supabase/functions/_shared/pluggy-linhas";

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

describe("pluggy budget — Open Finance allows 240 fresh pulls per month per bank", () => {
  it("never plans more than the monthly budget, which stays under Open Finance's cap", () => {
    expect(ORCAMENTO_MES).toBeLessThan(LIMITE_OPEN_FINANCE_MES);
    // spend the whole allowance every day of October: the month never passes the budget
    let gastos = 0;
    for (let d = 1; d <= 31; d++) {
      const agora = brt(`2026-10-${String(d).padStart(2, "0")} 10:00`);
      gastos += cotaDeHoje(gastos, 0, agora);
    }
    expect(gastos).toBeLessThanOrEqual(ORCAMENTO_MES);
    expect(gastos).toBeGreaterThan(ORCAMENTO_MES - 31);
  });

  it("days left include today; a quiet day leaves budget for the next ones", () => {
    expect(diasRestantesNoMes(brt("2026-10-31 23:00"))).toBe(1);
    expect(diasRestantesNoMes(brt("2026-10-01 00:30"))).toBe(31);
    const normal = cotaDeHoje(150, 0, brt("2026-10-20 10:00"));
    const depoisDeFolga = cotaDeHoje(120, 0, brt("2026-10-20 10:00"));
    expect(depoisDeFolga).toBeGreaterThan(normal);
    // pulls already made today come off today's allowance
    expect(cotaDeHoje(150, 3, brt("2026-10-20 10:00"))).toBe(cotaDeHoje(147, 0, brt("2026-10-20 10:00")) - 3);
  });

  it("Foco interval: more budget → closer pulls, never under Pluggy's cap; 2 kept for after the Foco", () => {
    expect(intervaloFocoMin(2)).toBe(Infinity);
    expect(intervaloFocoMin(6, 61)).toBe(61);
    expect(intervaloFocoMin(6, 15)).toBe(60); // 240 min ÷ 4
    expect(intervaloFocoMin(18, 15)).toBe(15);
    expect(intervaloFocoMin(4, 15)).toBe(120);
  });

  it("Foco with no budget left: no Foco pulls, the closing read still runs", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, disponivelHoje: 2 }))).toBeNull();
    const abre = 5 + deslocamento(UID, 175);
    const instante = new Date(brt("2026-10-09 00:00").getTime() + abre * 60_000);
    expect(motivoDeLeitura(base({ agora: instante, ultimaLeitura: brt("2026-10-08 15:05"), disponivelHoje: 0 }))).toBe("fechamento");
  });

  it("Foco pulls follow the interval from the last pull", () => {
    const ctx = { focoAtivo: true, disponivelHoje: 10, pedidoMinMin: 15, ultimaLeitura: brt("2026-10-08 14:00") };
    // 10 − 2 reserved = 8 → every 30 min
    expect(motivoDeLeitura(base({ ...ctx, ultimoPedido: brt("2026-10-08 14:00") }))).toBe("foco");
    expect(motivoDeLeitura(base({ ...ctx, agora: brt("2026-10-08 14:20"), ultimoPedido: brt("2026-10-08 14:00") }))).toBeNull();
  });

  it("morning read only when the month has budget to spare", () => {
    const abre = 8 * 60 + deslocamento(UID, 120);
    const h = String(Math.floor(abre / 60)).padStart(2, "0");
    const m = String(abre % 60).padStart(2, "0");
    const naHora = brt(`2026-10-08 ${h}:${m}`);
    const ctx = { agora: naHora, ultimaLeitura: brt("2026-10-08 01:00") };
    expect(motivoDeLeitura(base({ ...ctx, disponivelHoje: 7 }))).toBe("manha");
    expect(motivoDeLeitura(base({ ...ctx, disponivelHoje: 3 }))).toBeNull();
  });

  it("a pull needs budget and Pluggy's interval", () => {
    const agora = brt("2026-10-08 18:00");
    expect(podePedir(null, 0, agora)).toBe(false);
    expect(podePedir(brt("2026-10-08 17:30"), 5, agora, 61)).toBe(false);
    expect(podePedir(brt("2026-10-08 16:50"), 5, agora, 61)).toBe(true);
  });

  it("counters restart with the month and the day", () => {
    const agora = brt("2026-11-01 09:00");
    const o = orcamentoDaConexao({ pedidos_mes: "2026-10", pedidos_mes_qtd: 200, pedidos_dia: "2026-10-31", pedidos_dia_qtd: 6 }, agora);
    expect(o.pedidosMes).toBe(0);
    expect(o.pedidosHoje).toBe(0);
    expect(o.disponivelHoje).toBe(Math.floor(ORCAMENTO_MES / 30));
    expect(contarPedido(o)).toEqual({ pedidos_mes: "2026-11", pedidos_mes_qtd: 1, pedidos_dia: "2026-11-01", pedidos_dia_qtd: 1 });
  });

  it("imports since the day before the last read, so a gap never loses entries", () => {
    const agora = brt("2026-10-08 02:00");
    expect(diasParaImportar(brt("2026-10-07 21:00"), agora, 2)).toBe(2);
    expect(diasParaImportar(brt("2026-10-04 21:00"), agora, 2)).toBe(5);
    expect(diasParaImportar(brt("2026-09-01 21:00"), agora, 2)).toBe(6);
    expect(diasParaImportar(null, agora, 1)).toBe(6);
  });
});

describe("bank entries import — only new or changed rows are written", () => {
  const l = (id: string, amount = 10) => ({
    transaction_id: id, amount, description: "PIX RECEBIDO", transaction_date: "2026-10-08",
    transacted_at: "2026-10-08T15:00:00.000Z", is_pix: true, own_transfer: false,
    user_id: "u", bank_connection_id: "c",
  });
  it("skips identical rows, keeps new and changed ones", () => {
    const linhas = [l("a"), l("b"), l("c", 25)];
    const existentes = [
      { ...l("a"), transacted_at: "2026-10-08T15:00:00+00:00" }, // same instant, other format
      l("c", 20),
    ];
    expect(linhasMudadas(linhas, existentes).map((x) => x.transaction_id)).toEqual(["b", "c"]);
  });
});
