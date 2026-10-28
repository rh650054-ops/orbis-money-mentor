/* Ícone/cor do tempo pelo código WMO (sem JSX: usado pelo chip e pela tela). */
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudRainWind, CloudSun, Moon, Sun, type LucideIcon } from "lucide-react";

const AZUL = "#6FA8FF";

export function iconeDo(codigo: number | null | undefined, dia = true): { Icone: LucideIcon; cor: string } {
  const c = codigo ?? 3;
  if (c >= 95) return { Icone: CloudLightning, cor: "#FF6B5E" };
  if (c === 65 || c === 82) return { Icone: CloudRainWind, cor: AZUL };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { Icone: CloudRain, cor: AZUL };
  if (c >= 51 && c <= 57) return { Icone: CloudDrizzle, cor: AZUL };
  if (c === 45 || c === 48) return { Icone: CloudFog, cor: "#b3ada3" };
  if (c === 3) return { Icone: Cloud, cor: "#d8d3c9" };
  if (c >= 1) return dia ? { Icone: CloudSun, cor: "#F5B800" } : { Icone: CloudMoon, cor: "#b9b4ff" };
  return dia ? { Icone: Sun, cor: "#F5B800" } : { Icone: Moon, cor: "#b9b4ff" };
}

export const ehDiaHora = (h: number) => h >= 6 && h < 18;

/** 27/10 (Rick: "garoa com 0%"): the % shown is the forecast's chance of rain, like the
 *  iPhone (precipitation probability); falls back to the model vote when missing. */
export function probDaHora(h: { prob?: number | null; chance?: number | null }): number {
  return Math.round(h.prob ?? h.chance ?? 0);
}

/** A rain/drizzle icon only when the number agrees: below 20% and under 0.2 mm the
 *  icon falls back to the sky (cloud / sun), so the screen never shows "garoa · 0%". */
export function codigoCoerente(codigo: number | null | undefined, prob: number | null | undefined, mm?: number | null): number | null {
  if (codigo == null) return null;
  const chuvoso = codigo >= 51 && codigo <= 99 && codigo !== 45 && codigo !== 48;
  if (chuvoso && (prob ?? 0) < 20 && (mm ?? 0) < 0.2) return 3;
  return codigo;
}
