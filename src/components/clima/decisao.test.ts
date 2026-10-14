import { describe, expect, it } from "vitest";
import type { DiaClima, HoraClima, Tempo } from "@/hooks/useClima";
import { decisaoAgora, janelaDoDia, janelasDeVenda, planoDoDia, resumoDia, resumoVenda, statusHora } from "./decisao";
import { lerMovimento } from "./tela/visual";
import { notaDaHora } from "./picos";

const hora = (h: number, chance: number, o: Partial<HoraClima> = {}): HoraClima => ({
  hora: h, iso: `2026-10-08T${String(h).padStart(2, "0")}:00`, fontes: 0, total: 6, mm: chance >= 60 ? 3 : 0,
  temp: 23, prob: chance, codigo: chance >= 60 ? 63 : 3, chance, ...o,
});
const tempo = (horas: HoraClima[], o: Partial<Tempo> = {}): Tempo => ({
  estado: "nublado", temp: 23, sensacao: 24, max: 26, min: 18, vento: 10, rajada: null, condicao: "Nublado", codigo: 3, ehDia: true,
  horas, fontesTotal: 6, fontesOk: [], concordancia: 80, alerta: null, chuva: null, cidade: "Porto Alegre", uf: "RS", ...o,
});
// 14h chuva forte, 15h instável, 16h abrindo, 17h+ seco
const dia = [hora(14, 90, { mm: 6, codigo: 65 }), hora(15, 45), hora(16, 15), hora(17, 10), hora(18, 8), hora(19, 10), hora(20, 20)];

describe("Clima · decisão", () => {
  it("hora a hora segue o exemplo do prompt", () => {
    expect(statusHora(dia[0]!)).toMatchObject({ nivel: "risco", texto: "não sair", intensidade: "chuva forte" });
    expect(statusHora(dia[1]!, dia[0])).toMatchObject({ nivel: "atencao", texto: "espera mais", intensidade: "instável" });
    expect(statusHora(dia[2]!, dia[1])).toMatchObject({ texto: "boa pra vender" });
    expect(statusHora(hora(16, 15), hora(15, 70))).toMatchObject({ texto: "janela curta", intensidade: "abrindo" });
  });

  it("chovendo agora: manda esperar até a hora que abre", () => {
    expect(decisaoAgora(tempo(dia, { estado: "chuva" }))).toMatchObject({ titulo: "Espera até 16h", nivel: "atencao" });
  });

  it("seco agora mas chuva em 2h: janela curta", () => {
    const h = [hora(10, 5), hora(11, 10), hora(12, 80), hora(13, 85)];
    expect(decisaoAgora(tempo(h)).titulo).toBe("Janela curta até 12h");
  });

  it("alerta oficial laranja: pausa a venda, e o plano começa pela segurança", () => {
    const t = tempo(dia, { oficiais: [{ tipo: "Tempestade", severidade: "Perigo", nivel: "laranja", inicio: "2026-10-08 00:01", fim: "2026-10-08 23:59", riscos: "", instrucoes: [] }] });
    const agora = new Date("2026-10-08T14:00:00-03:00");
    expect(decisaoAgora(t, { agora })).toMatchObject({ titulo: "Pausa a venda", nivel: "risco" });
    expect(planoDoDia(t, [], {}, agora)[0]).toMatchObject({ acao: "procura abrigo" });
  });

  it("alerta laranja do dia inteiro com sol agora: vende até a chuva chegar, perto de abrigo (Rick, 14/10)", () => {
    const of = { tipo: "Tempestade", severidade: "Perigo", nivel: "laranja" as const, inicio: "2026-10-08 09:00", fim: "2026-10-08 23:59", riscos: "", instrucoes: [] };
    const h = [hora(11, 10, { rajada: 15 }), hora(12, 9), hora(13, 13), hora(14, 32), hora(15, 46), hora(16, 94, { mm: 1, codigo: 61 }), hora(17, 54)];
    const t = tempo(h, { estado: "sol", oficiais: [of] });
    const agora = new Date("2026-10-08T11:40:00-03:00");
    const d = decisaoAgora(t, { agora });
    expect(d.titulo).toBe("Dá pra vender até 14h");
    expect(d.sub).toMatch(/Alerta laranja de tempestade do INMET até 23h59/);
    const p = planoDoDia(t, janelasDeVenda(t, []), {}, agora);
    expect(p[0]).toMatchObject({ acao: "sair pra vender" });
    expect(p.find((x) => x.acao === "recolhe")?.quando).toBe("16h");
    expect(p.some((x) => x.acao === "procura abrigo")).toBe(false);
  });

  it("alerta vermelho para a venda mesmo com sol", () => {
    const of = { tipo: "Tempestade", severidade: "Grande perigo", nivel: "vermelho" as const, inicio: "2026-10-08 09:00", fim: "2026-10-08 23:59", riscos: "", instrucoes: [] };
    const t = tempo([hora(11, 10), hora(12, 9)], { estado: "sol", oficiais: [of] });
    expect(decisaoAgora(t, { agora: new Date("2026-10-08T11:40:00-03:00") }).titulo).toBe("Pausa a venda");
  });

  it("motivo da janela nunca diz céu aberto em dia nublado", () => {
    const nublado = notaDaHora({ ...hora(12, 5), codigo: 3, temp: 25 }, [], []);
    expect(nublado.etiquetas).toContain("sem chuva");
    expect(nublado.etiquetas).not.toContain("céu aberto");
    const sol = notaDaHora({ ...hora(12, 5), codigo: 0, temp: 25 }, [], []);
    expect(sol.etiquetas).toContain("céu aberto");
  });

  it("plano do dia: espera agora, janela depois e reavaliar — coerente com as horas", () => {
    const t = tempo(dia, { estado: "chuva" });
    const j = janelasDeVenda(t, []);
    expect(j[0]?.de).toBeGreaterThanOrEqual(16);
    const p = planoDoDia(t, j, { meta: 300, vendidoHoje: 100 });
    expect(p.map((x) => x.acao)).toEqual(["espera", "sair pra vender", "reavaliar"]);
    expect(p[0]!.texto).toMatch(/até 16h/);
    expect(p[1]!.texto).toMatch(/Falta R\$\s?200,00 da meta/);
  });

  it("próximos dias: resumo e janela provável", () => {
    const d: DiaClima = { data: "2026-10-09", codigo: 63, max: 26, min: 18, prob: 80, mm: 12, conf: "media",
      horas: Array.from({ length: 17 }, (_, i) => ({ hora: i + 6, codigo: 3, temp: 22, chance: i + 6 < 15 ? 80 : 10, mm: i + 6 < 15 ? 2 : 0 })) };
    expect(resumoDia(d)).toBe("ruim cedo, melhora no fim da tarde");
    expect(janelaDoDia(d)).toBe("15h–19h");
  });

  it("radar: chuva forte agora e caindo, vento de oeste → se afastando para leste", () => {
    const h = [hora(14, 95, { dir: 270 }), hora(15, 60), hora(16, 30), hora(17, 10)];
    expect(lerMovimento(h).frase).toBe("A chuva está se afastando para leste");
    expect(lerMovimento([hora(9, 5), hora(10, 5)]).tipo).toBe("longe");
    expect(lerMovimento([hora(9, 10, { dir: 180 }), hora(10, 40), hora(11, 70), hora(12, 80)]).frase).toBe("Chuva se aproximando, vindo do sul");
  });

  it("próximos dias: resumo de venda curto", () => {
    const d = (f: (h: number) => number): DiaClima => ({ data: "2026-10-09", codigo: 3, max: 26, min: 18, prob: 50, mm: 1, conf: "media",
      horas: Array.from({ length: 17 }, (_, i) => ({ hora: i + 6, codigo: 3, temp: 22, chance: f(i + 6), mm: f(i + 6) >= 30 ? 1 : 0 })) });
    expect(resumoVenda(d((h) => (h < 12 ? 5 : 80)))).toBe("boa manhã");
    expect(resumoVenda(d(() => 5))).toBe("dia todo bom");
    expect(resumoVenda({ ...d(() => 90), prob: 90 })).toBe("dia de chuva");
  });
});
