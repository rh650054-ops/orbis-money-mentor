/* ============================================================
   PALETA CLIMÁTICA (08/10/2026, revisão visual).
   O amarelo VANT continua sendo a marca e o CTA. Estas cores são secundárias,
   sempre em baixa saturação/opacidade: ícones, barras, badges, glows e fundos.
   ============================================================ */
import type { Estado } from "../ClimaTipos";

export const CLIMA = {
  chuva: "#5B9BFF",       // azul frio
  chuvaLeve: "#9CC4FF",   // azul claro
  bom: "#3DD68C",         // janela favorável
  instavel: "#F5B800",    // atenção / espera
  risco: "#FF6B5E",       // perigo
  temporal: "#9B7BFF",    // roxo
  neutro: "#8f897f",
} as const;

/** Fundo do hero: reage ao céu, sempre discreto (gradiente, nunca chapado). */
export const ATMOSFERA: Record<Estado, { fundo: string; brilho: string }> = {
  chuva: { fundo: "linear-gradient(165deg, #0f2a33 0%, #0c1a22 45%, #0b0d10 100%)", brilho: "rgba(91,155,255,.20)" },
  tempestade: { fundo: "linear-gradient(165deg, #241a44 0%, #151133 45%, #0b0a12 100%)", brilho: "rgba(155,123,255,.22)" },
  nublado: { fundo: "linear-gradient(165deg, #1c2430 0%, #141820 50%, #0d0e11 100%)", brilho: "rgba(156,196,255,.12)" },
  sol: { fundo: "linear-gradient(165deg, #2c2410 0%, #17140c 50%, #0d0c0a 100%)", brilho: "rgba(245,184,0,.22)" },
  calor: { fundo: "linear-gradient(165deg, #33220e 0%, #1b130a 50%, #0e0c09 100%)", brilho: "rgba(255,159,67,.24)" },
  frio: { fundo: "linear-gradient(165deg, #172636 0%, #10171f 50%, #0c0e11 100%)", brilho: "rgba(156,196,255,.18)" },
  noite: { fundo: "linear-gradient(165deg, #0f1730 0%, #0b1020 50%, #08090d 100%)", brilho: "rgba(120,140,255,.16)" },
};

const DIRECOES = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];
/** Graus → nome do rumo ("leste"). */
export const rumo = (graus: number) => DIRECOES[Math.round((((graus % 360) + 360) % 360) / 45) % 8]!;
