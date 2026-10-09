/* 2 · PRÓXIMAS HORAS — logo depois do hero (v2, 08/10). Cards compactos que
   deslizam com snap: hora, ícone, temperatura, chance e estado curto. A cor é
   sutil (barra no topo + brilho): azul chuva, amarelo instável, verde
   favorável, coral perigo. Tocar abre o detalhe: umidade, vento, mm, sensação
   e confiança em português (o "x de 6 modelos" fica só no detalhe). */
import { useState } from "react";
import type { HoraClima } from "@/hooks/useClima";
import { chanceDe, confDe, CONF_TXT, statusHora } from "../decisao";
import { CLIMA } from "./paleta";
import { corDaHora } from "./visual";
import { COR, ChipConf, Folha, LinhaValor, Titulo, haptic } from "./comum";
import { IconeTempo } from "./IconeTempo";
import { ehDiaHora } from "./icone-tempo";

const fmt = (v: number | null | undefined, suf: string) => (v == null ? "–" : `${Math.round(v)}${suf}`);

export function HoraAHora({ horas }: { horas: HoraClima[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const lista = horas.slice(0, 24);
  const h = aberta != null ? lista[aberta] : undefined;
  return (
    <section aria-label="Hora a hora">
      <Titulo direita={<span className="text-[12px] font-semibold" style={{ color: COR.mute }}>deslize →</span>}>Próximas horas</Titulo>
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar" style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        <div className="flex gap-2 w-max pb-1">
          {lista.map((x, i) => {
            const st = statusHora(x, lista[i - 1]);
            const ch = chanceDe(x);
            const cor = corDaHora(st.intensidade, x.hora);
            const ativo = aberta === i;
            return (
              <button key={x.iso} type="button" onClick={() => { haptic(); setAberta(i); }}
                className="relative w-[78px] shrink-0 overflow-hidden rounded-[18px] border px-2 pt-3.5 pb-3 flex flex-col items-center gap-1.5 transition-[transform,background-color,border-color] duration-150 active:scale-[0.98] hover:bg-white/[.03]"
                style={{ scrollSnapAlign: "start", background: `linear-gradient(180deg, ${cor}${i === 0 ? "26" : "14"} 0%, #0e0e10 62%)`, borderColor: ativo ? `${cor}aa` : i === 0 ? `${cor}55` : "rgba(255,255,255,.07)" }}>
                <span className="absolute top-0 inset-x-3 h-[3px] rounded-b-full" style={{ background: cor, opacity: 0.85 }} aria-hidden />
                <span className="text-[13px] font-bold" style={{ color: i === 0 ? COR.ouro : "#c9c3b8" }}>{i === 0 ? "Agora" : `${x.hora}h`}</span>
                <IconeTempo codigo={x.codigo} dia={ehDiaHora(x.hora)} tamanho={26} />
                <span className="text-[17px] font-extrabold tabular-nums" style={{ color: COR.texto }}>{fmt(x.temp, "°")}</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: ch >= 30 ? CLIMA.chuvaLeve : COR.mute }}>{ch}%</span>
                <span className="text-[11.5px] font-bold leading-tight text-center" style={{ color: cor }}>{st.intensidade}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Folha open={!!h} onOpenChange={(o) => { if (!o) setAberta(null); }} titulo={h ? (aberta === 0 ? "Agora" : `${h.hora}h`) : ""}
        subtitulo={h ? `${statusHora(h, lista[(aberta ?? 0) - 1]).intensidade} · ${statusHora(h, lista[(aberta ?? 0) - 1]).texto}` : undefined}>
        {h && (
          <>
            <div className="flex items-center gap-3 -mt-1">
              <IconeTempo codigo={h.codigo} dia={ehDiaHora(h.hora)} tamanho={36} />
              <p className="text-[32px] font-extrabold tabular-nums" style={{ color: COR.texto }}>{fmt(h.temp, "°")}</p>
              <span className="ml-auto"><ChipConf conf={confDe(h)} /></span>
            </div>
            <div>
              <LinhaValor rotulo="Chance de chuva" valor={`${chanceDe(h)}%`} cor={CLIMA.chuvaLeve} forte />
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
