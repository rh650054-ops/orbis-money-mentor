/* 6 · PRÓXIMOS DIAS — carrossel com snap (v2, 08/10): dia, ícone, máx/mín,
   chance e um resumo de VENDA ("boa manhã"). Tocar abre o dia por hora com a
   recomendação e a confiança (cai com a distância: a tela não finge certeza). */
import { useState } from "react";
import type { DiaClima } from "@/hooks/useClima";
import { COR_NIVEL, janelaDoDia, nomeDia, resumoDia, resumoVenda } from "../decisao";
import { CLIMA } from "./paleta";
import { COR, ChipConf, Folha, Titulo, haptic } from "./comum";
import { IconeTempo } from "./IconeTempo";
import { ehDiaHora } from "./icone-tempo";

const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);

export function ProximosDias({ dias }: { dias: DiaClima[] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const d = aberto != null ? dias[aberto] : undefined;
  if (dias.length === 0) return null;
  return (
    <section aria-label="Próximos dias">
      <Titulo>Próximos dias</Titulo>
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar" style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        <div className="flex gap-2 w-max pb-1">
          {dias.map((x, i) => {
            const venda = resumoVenda(x);
            const bom = venda.startsWith("boa") || venda === "dia todo bom";
            const corV = bom ? CLIMA.bom : venda === "dia de chuva" ? CLIMA.chuvaLeve : COR.mute;
            return (
              <button key={x.data} type="button" onClick={() => { haptic(); setAberto(i); }}
                className="w-[96px] shrink-0 rounded-[18px] border px-2.5 pt-3 pb-3 flex flex-col items-center gap-1.5 transition-[transform,background-color] duration-150 active:scale-[0.98] hover:bg-white/[.03]"
                style={{ scrollSnapAlign: "start", background: i === 0 ? "#151517" : "#0e0e10", borderColor: i === 0 ? "rgba(245,184,0,.3)" : "rgba(255,255,255,.07)" }}>
                <span className="text-[12px] font-black uppercase tracking-[.1em]" style={{ color: i === 0 ? COR.ouro : "#c9c3b8" }}>{nomeDia(x.data, i)}</span>
                <IconeTempo codigo={x.codigo} tamanho={28} />
                <span className="text-[15px] font-extrabold tabular-nums" style={{ color: COR.texto }}>{r(x.max)}<span style={{ color: COR.mute }}> / {r(x.min)}</span></span>
                <span className="text-[14px] font-bold tabular-nums" style={{ color: (x.prob ?? 0) >= 30 ? CLIMA.chuvaLeve : COR.mute }}>{x.prob ?? 0}%</span>
                <span className="text-[12px] font-bold text-center leading-tight" style={{ color: corV }}>{venda}</span>
              </button>
            );
          })}
        </div>
      </div>

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
