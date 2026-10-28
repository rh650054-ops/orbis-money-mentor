/* The one-line summary on top of "Próximas horas" (27/10/2026), like the sentence the
   iPhone shows above its hourly strip. Pure, so it is tested. Uses the same % the strip
   shows (probDaHora), so the sentence and the numbers never disagree. */
import type { HoraClima } from "@/hooks/useClima";
import { probDaHora } from "./icone-tempo";

const molha = (h: HoraClima) => probDaHora(h) >= 30 || (h.mm ?? 0) >= 0.2;

export function resumoHoras(horas: HoraClima[], tempAgora: number): string {
  const hs = horas.slice(0, 24);
  if (hs.length === 0) return "";
  const partes: string[] = [];

  if (molha(hs[0]!) && ((hs[0]!.mm ?? 0) >= 0.2 || probDaHora(hs[0]!) >= 60)) {
    const para = hs.findIndex((h, i) => i > 0 && !molha(h));
    partes.push(para > 0 ? `Chuva agora; deve parar por volta das ${hs[para]!.hora}h.` : "Chuva agora e pelas próximas horas.");
  } else {
    const ini = hs.findIndex(molha);
    if (ini < 0) partes.push("Sem chuva nas próximas 24 horas.");
    else {
      let fim = ini;
      while (fim + 1 < hs.length && molha(hs[fim + 1]!)) fim++;
      const trecho = hs.slice(ini, fim + 1);
      const mm = trecho.reduce((s, h) => s + (h.mm ?? 0), 0);
      const pico = Math.max(...trecho.map(probDaHora));
      const tipo = mm < 0.5 ? "Garoa fraca possível" : "Chuva";
      const quando = ini === fim ? `por volta das ${hs[ini]!.hora}h` : `entre ${hs[ini]!.hora}h e ${(hs[fim]!.hora + 1) % 24}h`;
      partes.push(`${tipo} ${quando} (até ${pico}%).`);
    }
  }

  const prox = hs.slice(1, 18).filter((h) => h.temp != null) as (HoraClima & { temp: number })[];
  if (prox.length) {
    const max = prox.reduce((m, h) => (h.temp > m.temp ? h : m));
    const min = prox.reduce((m, h) => (h.temp < m.temp ? h : m));
    if (max.temp >= tempAgora + 2) partes.push(`Chega a ${Math.round(max.temp)}° às ${max.hora}h.`);
    else if (min.temp <= tempAgora - 2) partes.push(`Esfria até ${Math.round(min.temp)}° às ${min.hora}h.`);
  }
  return partes.join(" ");
}
