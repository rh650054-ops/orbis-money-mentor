/* Previsão guardada no aparelho não pode fingir que é de agora (Rick, 14/10:
   na quarta a tela mostrava "Hoje, Amanhã, Ter, Qua" — a leitura de domingo).
   Tira os dias e as horas que já passaram, e o "Hoje" vem da DATA, não da
   posição na lista. */
import type { Tempo } from "@/hooks/useClima";

/** "YYYY-MM-DDTHH" agora, no fuso de Brasília (mesmo formato das horas da previsão). */
export function horaAgoraBR(agora: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(agora).map((x) => [x.type, x.value]),
  );
  const hora = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hora}`;
}

/** A previsão sem o passado. `velha` = os dias da leitura não começam hoje. */
export function tempoDeAgora(t: Tempo, agoraBR: string = horaAgoraBR()): { tempo: Tempo; velha: boolean } {
  const hoje = agoraBR.slice(0, 10);
  const dias = (t.dias ?? []).filter((d) => d.data >= hoje);
  const horas = t.horas.filter((h) => h.iso.slice(0, 13) >= agoraBR);
  const primeiroDia = t.dias?.[0]?.data ?? t.horas[0]?.iso.slice(0, 10) ?? hoje;
  return { tempo: { ...t, dias, horas: horas.length > 0 ? horas : t.horas.slice(-1) }, velha: primeiroDia < hoje };
}

/** "Hoje" / "Amanhã" pela data; o resto, dia da semana curto ("Sex"). */
export function nomeDiaPelaData(iso: string, hoje: string): string {
  if (iso === hoje) return "Hoje";
  const amanha = new Date(`${hoje}T12:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  if (iso === amanha.toISOString().slice(0, 10)) return "Amanhã";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" })
    .replace(".", "").replace(/^\w/, (l) => l.toUpperCase());
}

/** "hoje às 9h40" / "ontem às 21h05" / "dom, 12/10 às 18h00" — quando foi a leitura. */
export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(x);
  const hm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d).replace(":", "h");
  const ontem = new Date(agora.getTime() - 86_400_000);
  if (dia(d) === dia(agora)) return `hoje às ${hm}`;
  if (dia(d) === dia(ontem)) return `ontem às ${hm}`;
  const qual = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(d).replace(".", "");
  return `${qual} às ${hm}`;
}
