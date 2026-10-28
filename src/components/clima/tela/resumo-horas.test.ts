import { describe, expect, it } from "vitest";
import type { HoraClima } from "@/hooks/useClima";
import { resumoHoras } from "./resumo-horas";
import { codigoCoerente, probDaHora } from "./icone-tempo";
import { diaDeVenda } from "../dia-venda";

const h = (hora: number, temp: number, prob = 0, mm = 0, codigo = 3): HoraClima =>
  ({ hora, iso: `2026-10-28T${String(hora).padStart(2, "0")}:00`, fontes: 0, total: 6, mm, temp, prob, codigo, chance: prob });

describe("Clima v3 (27/10) — números que não se contradizem", () => {
  it("resumo das horas: noite seca, garoa cedo e máxima à tarde (dados reais de Cotia 27/10)", () => {
    const horas = [h(21, 14), h(22, 14), h(23, 14), h(0, 14), h(1, 14, 1), h(2, 14, 3), h(3, 14, 6), h(4, 14, 10), h(5, 14, 16),
      h(6, 14, 20), h(7, 15, 23, 0.1, 53), h(8, 16, 30, 0.1, 51), h(9, 17, 25, 0.1), h(10, 19, 19), h(11, 20, 10), h(12, 21, 4), h(13, 21, 6)];
    expect(resumoHoras(horas, 14)).toBe("Garoa fraca possível por volta das 8h (até 30%). Chega a 21° às 12h.");
  });

  it("sem chuva nas próximas horas diz isso de cara", () => {
    expect(resumoHoras([h(14, 25), h(15, 26), h(16, 26)], 25)).toBe("Sem chuva nas próximas 24 horas.");
  });

  it("chovendo agora diz quando para", () => {
    expect(resumoHoras([h(15, 20, 90, 2, 63), h(16, 20, 70, 1, 61), h(17, 19, 10, 0)], 20)).toBe("Chuva agora; deve parar por volta das 17h.");
  });

  it("o % é a chance da previsão (como no iPhone) e o ícone de chuva só aparece se o número concorda", () => {
    expect(probDaHora({ prob: 26, chance: 70 })).toBe(26);
    expect(probDaHora({ prob: null, chance: 40 })).toBe(40);
    expect(codigoCoerente(51, 0, 0)).toBe(3); // "garoa com 0%" não existe mais
    expect(codigoCoerente(51, 26, 0.1)).toBe(51);
    expect(codigoCoerente(1, 0, 0)).toBe(1);
  });

  it("o dia guarda a chance do dia inteiro (probDia) e mantém `prob` das horas de venda pro motor de decisão", () => {
    const d = diaDeVenda({ data: "2026-10-28", codigo: 55, max: 22, min: 14, prob: 26, mm: 3.1, conf: "alta",
      horas: [{ hora: 8, codigo: 51, temp: 16, chance: 20, mm: 0.1 }, { hora: 12, codigo: 3, temp: 21, chance: 4, mm: 0 }] });
    expect(d.probDia).toBe(26);
    expect(d.prob).toBe(20);
  });
});
