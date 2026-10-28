/* 2 · PRÓXIMAS HORAS (v3, 27/10/2026 — referência: o Clima do iPhone/Android).
   Um card com uma frase-resumo e a faixa de horas em colunas finas: hora, chance de
   chuva (só quando ≥ 20%), ícone e temperatura. "Agora" usa o MESMO número do topo.
   Tocar numa hora abre o detalhe (umidade, vento, mm, sensação, confiança). */
import { useState } from "react";
import type { HoraClima } from "@/hooks/useClima";
import { confDe, CONF_TXT, statusHora } from "../decisao";
import { CLIMA } from "./paleta";
import { COR, ChipConf, Folha, LinhaValor, haptic } from "./comum";
import { IconeTempo } from "./IconeTempo";
import { codigoCoerente, ehDiaHora, probDaHora } from "./icone-tempo";
import { resumoHoras } from "./resumo-horas";

const fmt = (v: number | null | undefined, suf: string) => (v == null ? "–" : `${Math.round(v)}${suf}`);

export function HoraAHora({ horas, tempAgora }: { horas: HoraClima[]; tempAgora: number }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const lista = horas.slice(0, 24);
  const h = aberta != null ? lista[aberta] : undefined;
  if (lista.length === 0) return null;
  return (
    <section aria-label="Próximas horas" className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: COR.borda, background: COR.surface }}>
      <p className="border-b pb-2 text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: COR.mute, borderColor: COR.borda }}>Próximas horas</p>
      <p className="border-b py-2.5 text-[13.5px] leading-snug" style={{ color: COR.texto, borderColor: COR.borda }}>{resumoHoras(lista, tempAgora)}</p>
      <div className="-mx-3.5 overflow-x-auto px-1.5 pt-2 no-scrollbar">
        <div className="flex w-max">
          {lista.map((x, i) => {
            const p = probDaHora(x);
            return (
              <button key={x.iso} type="button" onClick={() => { haptic(); setAberta(i); }} aria-label={`${i === 0 ? "Agora" : `${x.hora}h`}, ${fmt(i === 0 ? tempAgora : x.temp, " graus")}, chuva ${p}%`}
                className="flex w-[54px] shrink-0 flex-col items-center gap-1 rounded-xl py-1 transition-colors active:bg-white/[.05]">
                <span className="text-[12px] font-semibold" style={{ color: i === 0 ? COR.texto : COR.sub }}>{i === 0 ? "Agora" : `${x.hora}h`}</span>
                <span className="h-[14px] text-[11px] font-bold tabular-nums" style={{ color: CLIMA.chuvaLeve }}>{p >= 20 ? `${p}%` : ""}</span>
                <IconeTempo codigo={codigoCoerente(x.codigo, p, x.mm)} dia={ehDiaHora(x.hora)} tamanho={22} />
                <span className="text-[15px] font-semibold tabular-nums" style={{ color: COR.texto }}>{fmt(i === 0 ? tempAgora : x.temp, "°")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Folha open={!!h} onOpenChange={(o) => { if (!o) setAberta(null); }} titulo={h ? (aberta === 0 ? "Agora" : `${h.hora}h`) : ""}
        subtitulo={h ? `${statusHora(h, lista[(aberta ?? 0) - 1]).intensidade} · ${statusHora(h, lista[(aberta ?? 0) - 1]).texto}` : undefined}>
        {h && (
          <>
            <div className="-mt-1 flex items-center gap-3">
              <IconeTempo codigo={codigoCoerente(h.codigo, probDaHora(h), h.mm)} dia={ehDiaHora(h.hora)} tamanho={32} />
              <p className="text-[28px] font-bold tabular-nums" style={{ color: COR.texto }}>{fmt(aberta === 0 ? tempAgora : h.temp, "°")}</p>
              <span className="ml-auto"><ChipConf conf={confDe(h)} /></span>
            </div>
            <div>
              <LinhaValor rotulo="Chance de chuva" valor={`${probDaHora(h)}%`} cor={CLIMA.chuvaLeve} forte />
              <LinhaValor rotulo="Chuva estimada" valor={h.mm >= 0.1 ? `${h.mm.toFixed(1)} mm` : "nada"} />
              <LinhaValor rotulo="Sensação térmica" valor={fmt(h.sens ?? h.temp, "°")} />
              <LinhaValor rotulo="Umidade" valor={fmt(h.umid, "%")} />
              <LinhaValor rotulo="Vento" valor={h.vento != null ? `${Math.round(h.vento)} km/h${h.rajada ? ` · rajadas ${Math.round(h.rajada)}` : ""}` : "–"} />
            </div>
            <p className="text-[13px] leading-snug" style={{ color: COR.mute }}>
              {CONF_TXT[confDe(h)].curto}: {CONF_TXT[confDe(h)].longo}.{h.total > 0 ? ` ${h.fontes} de ${h.total} modelos apostam em chuva nessa hora.` : ""}
            </p>
          </>
        )}
      </Folha>
    </section>
  );
}
