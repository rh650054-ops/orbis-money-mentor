/* 4 · HORA A HORA — a parte central. Uma linha que desliza com as próximas
   12–24 horas: hora, ícone, temperatura, chance de chuva em %, condição e o que
   fazer. Junta o antigo "chance de chuva" (6 de 6 vira confiança em português).
   Tocar numa hora abre o detalhe: umidade, vento, mm, sensação e confiança. */
import { useState } from "react";
import type { HoraClima } from "@/hooks/useClima";
import { chanceDe, confDe, CONF_TXT, COR_NIVEL, statusHora } from "../decisao";
import { COR, ChipConf, Folha, LinhaValor, Titulo, haptic } from "./comum";
import { IconeTempo, ehDiaHora } from "./IconeTempo";

const fmt = (v: number | null | undefined, suf: string) => (v == null ? "–" : `${Math.round(v)}${suf}`);

export function HoraAHora({ horas }: { horas: HoraClima[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const lista = horas.slice(0, 24);
  const h = aberta != null ? lista[aberta] : undefined;
  return (
    <section aria-label="Hora a hora">
      <Titulo direita={<span className="text-[12px] font-semibold" style={{ color: COR.mute }}>deslize →</span>}>Hora a hora</Titulo>
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar" style={{ scrollSnapType: "x proximity" }}>
        <div className="flex gap-2 w-max pb-1">
          {lista.map((x, i) => {
            const st = statusHora(x, lista[i - 1]);
            const ch = chanceDe(x);
            const ativo = aberta === i;
            return (
              <button key={x.iso} type="button" onClick={() => { haptic(); setAberta(i); }}
                className="w-[86px] shrink-0 rounded-[16px] border px-2 py-3 flex flex-col items-center gap-1 transition-[transform,background-color,border-color] duration-150 active:scale-[0.97]"
                style={{ scrollSnapAlign: "start", background: ativo ? "#18181b" : "#0e0e10", borderColor: ativo ? `${COR_NIVEL[st.nivel]}88` : "rgba(255,255,255,.07)" }}>
                <span className="text-[13px] font-bold" style={{ color: i === 0 ? COR.ouro : COR.sub }}>{i === 0 ? "Agora" : `${x.hora}h`}</span>
                <IconeTempo codigo={x.codigo} dia={ehDiaHora(x.hora)} tamanho={24} />
                <span className="text-[16px] font-bold tabular-nums" style={{ color: COR.texto }}>{fmt(x.temp, "°")}</span>
                <span className="text-[15px] font-extrabold tabular-nums" style={{ color: ch >= 30 ? "#6FA8FF" : COR.mute }}>{ch}%</span>
                <span className="text-[11.5px] leading-tight text-center" style={{ color: COR.sub }}>{st.intensidade}</span>
                <span className="mt-0.5 text-[11.5px] font-bold leading-tight text-center" style={{ color: COR_NIVEL[st.nivel] }}>{st.texto}</span>
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
              <LinhaValor rotulo="Chance de chuva" valor={`${chanceDe(h)}%`} cor="#6FA8FF" forte />
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
