/* 6 · PRÓXIMOS 7 DIAS (v3, 27/10/2026 — referência: o Clima do iPhone/Android).
   Uma lista: dia (+ resumo de venda embaixo), ícone, chance de chuva do DIA INTEIRO
   (como no iPhone; antes era só das horas de venda), mínima, barra de mínima→máxima
   na escala da semana e máxima. Tocar abre o dia por hora, com a chance nas suas
   horas de venda e a recomendação (a folha de detalhe de antes, sem mudança). */
import { useState } from "react";
import type { DiaClima } from "@/hooks/useClima";
import { COR_NIVEL, janelaDoDia, resumoDia, resumoVenda } from "../decisao";
import { nomeDiaPelaData } from "../frescor";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { CLIMA } from "./paleta";
import { COR, ChipConf, Folha, haptic } from "./comum";
import { IconeTempo } from "./IconeTempo";
import { codigoCoerente, ehDiaHora } from "./icone-tempo";

const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);
const probDia = (d: DiaClima) => Math.round(d.probDia ?? d.prob ?? 0);

export function ProximosDias({ dias, tempAgora }: { dias: DiaClima[]; tempAgora: number }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const d = aberto != null ? dias[aberto] : undefined;
  const hoje = getBrazilDate();
  if (dias.length === 0) return null;
  const mins = dias.map((x) => x.min ?? Infinity), maxs = dias.map((x) => x.max ?? -Infinity);
  const lo = Math.min(...mins, tempAgora), hi = Math.max(...maxs, tempAgora);
  const pos = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0);
  return (
    <section aria-label="Próximos dias" className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: COR.borda, background: COR.surface }}>
      <p className="border-b pb-2 text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: COR.mute, borderColor: COR.borda }}>Próximos {dias.length} dias</p>
      {dias.map((x, i) => {
        const p = probDia(x);
        const venda = resumoVenda(x);
        const bom = venda.startsWith("boa") || venda === "dia todo bom";
        return (
          <button key={x.data} type="button" onClick={() => { haptic(); setAberto(i); }}
            className="grid w-full grid-cols-[minmax(0,1fr)_26px_36px_28px_minmax(0,1.1fr)_28px] items-center gap-1.5 border-t py-2 text-left first-of-type:border-t-0 active:bg-white/[.03]"
            style={{ borderColor: COR.borda }}>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold capitalize" style={{ color: i === 0 ? COR.ouro : COR.texto }}>{nomeDiaPelaData(x.data, hoje)}</span>
              <span className="block truncate text-[11px] font-semibold" style={{ color: bom ? CLIMA.bom : COR.mute }}>{venda}</span>
            </span>
            <IconeTempo codigo={codigoCoerente(x.codigo, p, x.mmVenda ?? x.mm)} tamanho={20} />
            <span className="text-[11.5px] font-bold tabular-nums" style={{ color: CLIMA.chuvaLeve }}>{p >= 20 ? `${p}%` : ""}</span>
            <span className="text-right text-[14px] tabular-nums" style={{ color: COR.mute }}>{r(x.min)}</span>
            <span className="relative mx-1 h-[5px] rounded-full" style={{ background: "#232323" }} aria-hidden>
              {x.min != null && x.max != null && (
                <i className="absolute inset-y-0 rounded-full" style={{ left: `${pos(x.min)}%`, right: `${100 - pos(x.max)}%`, background: "linear-gradient(90deg,#6FA8FF,#3DD68C,#F5B800,#FF9F43)" }} />
              )}
              {i === 0 && <i className="absolute -top-[2px] h-[9px] w-[9px] -translate-x-1/2 rounded-full border-2" style={{ left: `${pos(tempAgora)}%`, background: "#fff", borderColor: "#000" }} />}
            </span>
            <span className="text-right text-[14px] font-semibold tabular-nums" style={{ color: COR.texto }}>{r(x.max)}</span>
          </button>
        );
      })}
      <p className="mt-1 text-[11.5px] leading-snug" style={{ color: COR.mute }}>% = chance de chuva no dia todo. Toque no dia pra ver as suas horas de venda.</p>

      <Folha open={!!d} onOpenChange={(o) => { if (!o) setAberto(null); }} titulo={d ? nomeDiaPelaData(d.data, hoje) : ""}
        subtitulo={d ? `${r(d.max)} / ${r(d.min)} · ${probDia(d)}% no dia · nas suas horas de venda (7h–21h): ${d.garoa ? `garoa fraca (${d.mmVenda ?? 0} mm)` : `${d.prob ?? 0}%`} · ${resumoDia(d)}` : undefined} alta>
        {d && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,.07)" }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: COR.sub }}>Recomendação de venda</p>
                <p className="mt-0.5 text-[18px] font-bold" style={{ color: janelaDoDia(d) ? COR_NIVEL.bom : COR_NIVEL.atencao }}>
                  {janelaDoDia(d) ? `Melhor janela ${janelaDoDia(d)}` : "Sem janela seca"}
                </p>
              </div>
              <ChipConf conf={d.conf} />
            </div>
            <div>
              {d.horas.filter((h) => h.hora <= 22).map((h) => (
                <div key={h.hora} className="flex h-11 items-center gap-3 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                  <span className="w-10 text-[14px] font-bold tabular-nums" style={{ color: COR.sub }}>{h.hora}h</span>
                  <IconeTempo codigo={codigoCoerente(h.codigo, h.chance, h.mm)} dia={ehDiaHora(h.hora)} tamanho={20} />
                  <span className="w-10 text-[15px] font-bold tabular-nums" style={{ color: COR.texto }}>{r(h.temp)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#26241f" }}>
                    <span className="block h-full rounded-full" style={{ width: `${h.chance ?? 0}%`, background: "#6FA8FF" }} />
                  </span>
                  <span className="w-11 text-right text-[14px] font-bold tabular-nums" style={{ color: (h.chance ?? 0) >= 30 ? "#6FA8FF" : COR.mute }}>{h.chance ?? 0}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Folha>
    </section>
  );
}
