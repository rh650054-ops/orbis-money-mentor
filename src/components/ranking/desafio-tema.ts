/* Desafio Avante (30/10): each tab has its own identity — the month is gold with a crown,
   the week is electric blue with a lightning coin — so switching tabs feels like switching prize. */
import type { Aba } from "./premiacao";

export interface TemaDesafio {
  cor: string; claro: string; escuro: string; fundo: string;
  /** "r,g,b" for rgba() in inline styles and the --vant-rgb CSS variable */
  rgb: string;
  titulo: string; quem: string;
}

export const TEMAS: Record<Aba, TemaDesafio> = {
  mensal: {
    cor: "#F5B800", claro: "#FFE58A", escuro: "#7A5600", fundo: "#120d04", rgb: "245,184,0",
    titulo: "CAMPEÃO DE NOVEMBRO", quem: "pro campeão do mês",
  },
  semanal: {
    cor: "#38BDF8", claro: "#C4EEFF", escuro: "#0B4F78", fundo: "#03101a", rgb: "56,189,248",
    titulo: "DESAFIO DA SEMANA", quem: "pro melhor vendedor da semana",
  },
};

export const rgba = (t: TemaDesafio, a: number) => `rgba(${t.rgb},${a})`;
