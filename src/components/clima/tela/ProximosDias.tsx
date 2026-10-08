/* 5 · PRÓXIMOS DIAS — 7 dias: ícone, máx/mín, chance, resumo curto e a janela
   provável de venda. Tocar abre o dia por hora com recomendação e confiança.
   A confiança cai com a distância (dia 4+ é "baixa"): a tela não finge certeza. */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DiaClima } from "@/hooks/useClima";
import { COR_NIVEL, janelaDoDia, nomeDia, resumoDia } from "../decisao";
import { COR, Cartao, ChipConf, Folha, Titulo, haptic } from "./comum";
import { IconeTempo, ehDiaHora } from "./IconeTempo";

const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);

export function ProximosDias({ dias }: { dias: DiaClima[] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const d = aberto != null ? dias[aberto] : undefined;
  if (dias.length === 0) return null;
  return (
    <section aria-label="Próximos dias">
      <Titulo>Próximos dias</Titulo>
      <Cartao className="py-1">
        {dias.map((x, i) => {
          const j = janelaDoDia(x);
          return (
            <button key={x.data} type="button" onClick={() => { haptic(); setAberto(i); }}
              className="group w-full text-left flex items-center gap-3 py-3 border-t first:border-t-0 -mx-2 px-2 rounded-[12px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]"
              style={{ borderColor: "rgba(255,255,255,.06)" }}>
              <span className="w-[62px] shrink-0 text-[15px] font-bold" style={{ color: COR.texto }}>{nomeDia(x.data, i)}</span>
              <IconeTempo codigo={x.codigo} tamanho={24} />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: (x.prob ?? 0) >= 30 ? "#6FA8FF" : COR.mute }}>{x.prob ?? 0}% chuva</span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: COR.texto }}>{r(x.max)} <span style={{ color: COR.mute }}>/ {r(x.min)}</span></span>
                </span>
                <span className="block text-[13px] mt-0.5 leading-snug" style={{ color: COR.sub }}>
                  {resumoDia(x)}{j ? <> · <b style={{ color: COR_NIVEL.bom }}>{j}</b></> : ""}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5" style={{ color: "#5c5850" }} />
            </button>
          );
        })}
      </Cartao>

      <Folha open={!!d} onOpenChange={(o) => { if (!o) setAberto(null); }} titulo={d ? nomeDia(d.data, aberto ?? 0) : ""}
        subtitulo={d ? `${r(d.max)} / ${r(d.min)} · ${d.prob ?? 0}% chuva · ${resumoDia(d)}` : undefined} alta>
        {d && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,.07)" }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: COR.sub }}>Recomendação de venda</p>
                <p className="text-[20px] font-extrabold mt-0.5" style={{ color: janelaDoDia(d) ? COR_NIVEL.bom : COR_NIVEL.atencao }}>
                  {janelaDoDia(d) ? `Melhor janela ${janelaDoDia(d)}` : "Sem janela seca"}
                </p>
              </div>
              <ChipConf conf={d.conf} />
            </div>
            <div>
              {d.horas.filter((h) => h.hora <= 22).map((h) => (
                <div key={h.hora} className="flex items-center gap-3 h-11 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                  <span className="w-10 text-[14px] font-bold tabular-nums" style={{ color: COR.sub }}>{h.hora}h</span>
                  <IconeTempo codigo={h.codigo} dia={ehDiaHora(h.hora)} tamanho={20} />
                  <span className="text-[15px] font-bold tabular-nums w-10" style={{ color: COR.texto }}>{r(h.temp)}</span>
                  <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#26241f" }}>
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
