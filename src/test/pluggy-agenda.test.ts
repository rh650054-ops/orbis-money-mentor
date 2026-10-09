import { describe, expect, it } from "vitest";
import {
  motivoDeLeitura, deslocamento, relogioBRT, contarLeitura, podePuxarAgora,
  cotaDeHoje, diasRestantesNoMes, intervaloFocoMin, podePedir, orcamentoDaConexao, contarPedido, diasParaImportar,
  LIMITE_DIA, LIMITE_GLOBAL_DIA, ORCAMENTO_MES, LIMITE_OPEN_FINANCE_MES, FOCO_ALVO_MIN, TETO_DIA, CALMA_SE_SOBRAR,
  type Contexto,
} from "../../supabase/functions/_shared/pluggy-agenda";
import { linhasMudadas } from "../../supabase/functions/_shared/pluggy-linhas";

// Brasília = UTC-3. brt("2026-10-08 14:30") → that instant.
const brt = (s: string) => new Date(s.replace(" ", "T") + ":00-03:00");
const UID = "user-teste";

const baseOrig = (over: Partial<Contexto>): Contexto => ({
  agora: brt("2026-10-08 14:30"),
  userId: UID,
  ultimaLeitura: null,
  focoAtivo: false,
  focoFimEm: null,
  leiturasHoje: 0,
  leiturasGlobaisHoje: 0,
  ...over,
});
const base = baseOrig;

describe("pluggy agenda — when the bank is read", () => {
  it("vendor not selling in the afternoon: nothing until the next calm read", () => {
    expect(motivoDeLeitura(base({ ultimaLeitura: brt("2026-10-08 12:10") }))).toBeNull();
  });

  it("calm read outside the Foco: after 08:00 + offset, then every 4h", () => {
    const abre = 8 * 60 + deslocamento(UID, 60);
    const h = String(Math.floor(abre / 60)).padStart(2, "0");
    const m = String(abre % 60).padStart(2, "0");
    const naHora = brt(`2026-10-08 ${h}:${m}`);
    expect(motivoDeLeitura(base({ agora: naHora, ultimaLeitura: brt("2026-10-08 01:00") }))).toBe("calma");
    expect(motivoDeLeitura(base({ agora: new Date(naHora.getTime() + 2 * 3600_000), ultimaLeitura: naHora, ultimoPedido: naHora }))).toBeNull();
    expect(motivoDeLeitura(base({ agora: new Date(naHora.getTime() + 4 * 3600_000), ultimaLeitura: naHora, ultimoPedido: naHora }))).toBe("calma");
    expect(motivoDeLeitura(base({ agora: brt("2026-10-08 21:00"), ultimaLeitura: brt("2026-10-08 15:00") }))).toBeNull();
  });

  it("Foco on: reads right away, then once per hour", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 09:00") }))).toBe("foco");
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 14:00") }))).toBeNull();
    expect(motivoDeLeitura(base({ focoAtivo: true, ultimaLeitura: brt("2026-10-08 13:29") }))).toBe("foco");
  });

  it("after the Foco: one read soon after the end and one ~1h later, then nothing (tight month)", () => {
    const fim = brt("2026-10-08 14:00");
    const base = (o: Partial<Contexto>) => baseOrig({ disponivelHoje: 3, ...o });
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
  // play a whole month: every day a closing pull, then (optionally) a Foco 14h–18h with
  // the robot's rules, then the 2 after-Foco pulls, plus calm reads — return the total
  function simularMes(focoTodoDia: boolean, pedidoMin = 40, horasFoco = 4) {
    let mes = 0;
    const porDia: number[] = [];
    let intervaloUltimoDia = 0;
    for (let d = 1; d <= 31; d++) {
      const dia = `2026-10-${String(d).padStart(2, "0")}`;
      let hoje = 0;
      let ultimoPedido: Date | null = null;
      const pedir = (agora: Date, motivo: "fechamento" | "pos_foco" | "foco" | "calma") => {
        const disp = cotaDeHoje(mes, hoje, agora);
        if (podePedir(ultimoPedido, disp, agora, pedidoMin, { motivo, restanteMes: ORCAMENTO_MES - mes })) {
          mes++; hoje++; ultimoPedido = agora;
        }
      };
      pedir(brt(`${dia} 01:00`), "fechamento");
      for (const h of ["09:00", "13:00"]) {
        const agora = brt(`${dia} ${h}`);
        if (motivoDeLeitura(baseOrig({ agora, ultimaLeitura: ultimoPedido, ultimoPedido, disponivelHoje: cotaDeHoje(mes, hoje, agora), pedidoMinMin: pedidoMin })) === "calma") pedir(agora, "calma");
      }
      if (focoTodoDia) {
        for (let t = 14 * 60; t < (14 + horasFoco) * 60; t += 5) {
          const agora = new Date(brt(`${dia} 00:00`).getTime() + t * 60_000);
          const disp = cotaDeHoje(mes, hoje, agora);
          if (motivoDeLeitura(baseOrig({ agora, focoAtivo: true, ultimaLeitura: ultimoPedido, ultimoPedido, disponivelHoje: disp, pedidoMinMin: pedidoMin })) === "foco") pedir(agora, "foco");
          if (d === 31) intervaloUltimoDia = intervaloFocoMin(disp, pedidoMin);
        }
        pedir(brt(`${dia} ${String(14 + horasFoco).padStart(2, "0")}:10`), "pos_foco");
        pedir(brt(`${dia} ${String(15 + horasFoco).padStart(2, "0")}:15`), "pos_foco");
      }
      porDia.push(hoje);
    }
    return { mes, porDia, intervaloUltimoDia };
  }

  it("never passes the monthly budget, which stays under Open Finance's cap — even with a 6h Foco every day", () => {
    expect(ORCAMENTO_MES).toBeLessThan(LIMITE_OPEN_FINANCE_MES);
    for (const horas of [4, 6]) {
      const r = simularMes(true, 40, horas);
      expect(r.mes).toBeLessThanOrEqual(ORCAMENTO_MES);
      // the closing pull happens every single day, the month never freezes
      expect(r.porDia.every((n) => n >= 1)).toBe(true);
    }
  });

  it("a fresh month affords the 40-min Foco; a vendor without Foco spends little", () => {
    expect(intervaloFocoMin(cotaDeHoje(0, 0, brt("2026-11-01 14:00")), 40)).toBe(FOCO_ALVO_MIN);
    const semFoco = simularMes(false);
    expect(semFoco.mes).toBeLessThan(ORCAMENTO_MES);
  });

  it("days left include today; a quiet day leaves budget for the next ones", () => {
    expect(diasRestantesNoMes(brt("2026-10-31 23:00"))).toBe(1);
    expect(diasRestantesNoMes(brt("2026-10-01 00:30"))).toBe(31);
    const normal = cotaDeHoje(150, 0, brt("2026-10-20 10:00"));
    const depoisDeFolga = cotaDeHoje(110, 0, brt("2026-10-20 10:00"));
    expect(depoisDeFolga).toBeGreaterThan(normal);
    expect(cotaDeHoje(0, 0, brt("2026-11-01 10:00"))).toBeLessThanOrEqual(TETO_DIA);
  });

  it("Foco interval: 40 min when affordable, never under Pluggy's cap, longer when short; 1 kept for after", () => {
    expect(intervaloFocoMin(1)).toBe(Infinity);
    expect(intervaloFocoMin(10, 61)).toBe(61);
    expect(intervaloFocoMin(10, 15)).toBe(40);
    expect(intervaloFocoMin(4, 15)).toBe(80);
  });

  it("tight month (Mohamed 08/10: 80 pulls used by day 8, 7 for the day): the Foco still gets ~hourly reads", () => {
    const agora = brt("2026-10-08 16:00");
    // closing pull already made today: 6 left out of a 7-pull day
    const disp = cotaDeHoje(81, 1, agora);
    expect(disp + 1).toBe(7);
    expect(intervaloFocoMin(disp - 0, 61)).toBe(61);
    let leituras = 0, feitas = 1, ultimo: Date | null = null;
    for (let t = 15 * 60 + 48; t < 21 * 60; t += 5) {
      const ag = new Date(brt("2026-10-08 00:00").getTime() + t * 60_000);
      const d = cotaDeHoje(80 + feitas, feitas, ag);
      if (motivoDeLeitura(base({ agora: ag, focoAtivo: true, ultimaLeitura: ultimo, ultimoPedido: ultimo, disponivelHoje: d, cotaDoDia: d + feitas, pedidoMinMin: 61 })) === "foco") { leituras++; feitas++; ultimo = ag; }
    }
    expect(leituras).toBeGreaterThanOrEqual(5);
  });

  it("Foco with no budget left: no Foco pulls, the closing read still runs", () => {
    expect(motivoDeLeitura(base({ focoAtivo: true, disponivelHoje: 1 }))).toBeNull();
    const abre = 5 + deslocamento(UID, 175);
    const instante = new Date(brt("2026-10-09 00:00").getTime() + abre * 60_000);
    expect(motivoDeLeitura(base({ agora: instante, ultimaLeitura: brt("2026-10-08 15:05"), disponivelHoje: 0 }))).toBe("fechamento");
    // closing and after-Foco pulls spend the reserve, not today's allowance
    expect(podePedir(null, 0, instante, 61, { motivo: "fechamento", restanteMes: 5 })).toBe(true);
    expect(podePedir(null, 0, instante, 61, { motivo: "fechamento", restanteMes: 0 })).toBe(false);
    expect(podePedir(null, 0, instante, 61, { motivo: "foco", restanteMes: 5 })).toBe(false);
  });

  it("Foco pulls every 40 min once Pluggy lifts its hourly cap", () => {
    const ctx = { focoAtivo: true, disponivelHoje: 10, pedidoMinMin: 15, ultimaLeitura: brt("2026-10-08 13:50") };
    expect(motivoDeLeitura(base({ ...ctx, ultimoPedido: brt("2026-10-08 13:50") }))).toBe("foco");
    expect(motivoDeLeitura(base({ ...ctx, agora: brt("2026-10-08 14:20"), ultimoPedido: brt("2026-10-08 13:50"), ultimaLeitura: brt("2026-10-08 13:50") }))).toBeNull();
  });

  it("calm reads stop while the day must keep a full Foco aside", () => {
    const abre = 8 * 60 + deslocamento(UID, 60);
    const naHora = new Date(brt("2026-10-08 00:00").getTime() + (abre + 5) * 60_000);
    const ctx = { agora: naHora, ultimaLeitura: brt("2026-10-08 01:00") };
    expect(motivoDeLeitura(base({ ...ctx, disponivelHoje: CALMA_SE_SOBRAR }))).toBe("calma");
    expect(motivoDeLeitura(base({ ...ctx, disponivelHoje: CALMA_SE_SOBRAR - 1 }))).toBeNull();
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
    expect(o.restanteMes).toBe(ORCAMENTO_MES);
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
