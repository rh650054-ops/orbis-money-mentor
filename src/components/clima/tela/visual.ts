/* Leituras visuais do Clima (sem JSX): cor de cada hora e movimento da chuva pro radar. */
import type { HoraClima } from "@/hooks/useClima";
import { chanceDe, type Intensidade } from "../decisao";
import { CLIMA, rumo } from "./paleta";

/** Cor do estado da hora (linguagem climática, não a do vender/não vender). */
export function corDaHora(i: Intensidade, hora: number): string {
  if (i === "tempestade") return CLIMA.risco;
  if (i === "chuva forte" || i === "chuva") return CLIMA.chuva;
  if (i === "chuvisco") return CLIMA.chuvaLeve;
  if (i === "instável") return CLIMA.instavel;
  return hora < 5 ? CLIMA.neutro : CLIMA.bom;
}

export type Movimento = { frase: string; tipo: "longe" | "chegando" | "saindo" | "sobre" | "espalhada"; de: number; para: number; forca: number };

export function lerMovimento(horas: HoraClima[]): Movimento {
  const agora = horas[0] ? chanceDe(horas[0]) : 0;
  const prox = horas.slice(1, 4).map(chanceDe);
  const futuro = prox.length ? prox.reduce((a, b) => a + b, 0) / prox.length : agora;
  const de = horas[0]?.dir ?? horas[1]?.dir ?? 270;
  const para = (de + 180) % 360;
  const forca = Math.max(agora, ...prox);
  if (forca < 20) return { frase: "Sem chuva por perto", tipo: "longe", de, para, forca };
  if (agora >= 50 && futuro <= agora - 15) return { frase: `A chuva está se afastando para ${rumo(para)}`, tipo: "saindo", de, para, forca };
  if (agora < 45 && futuro >= agora + 15) return { frase: `Chuva se aproximando, vindo do ${rumo(de)}`, tipo: "chegando", de, para, forca };
  if (agora >= 50) return { frase: "Chuva em cima da sua região", tipo: "sobre", de, para, forca };
  return { frase: "Chuva espalhada, sem direção firme", tipo: "espalhada", de, para, forca };
}
