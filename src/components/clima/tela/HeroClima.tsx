/* 1 · CLIMA AGORA + DECISÃO — a CENA (v3, 08/10).
   Volta o formato da cena do Orbis (Rick, 08/10): o mascote da VANT grande no
   meio de uma cena de meia tela, vivo, com o tempo acontecendo em volta, e a
   temperatura por cima no canto de baixo. Logo abaixo, a decisão minimalista
   (um ponto de cor + a frase). Tocar na cena faz o mascote pular. */
import { useState } from "react";
import { Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import type { Rede, Tempo } from "@/hooks/useClima";
import { chanceDe, COR_NIVEL, type Decisao, type Janela } from "../decisao";
import { COR, haptic } from "./comum";
import { CLIMA } from "./paleta";
import { CenaVant } from "./CenaVant";

function haQuanto(iso: string | null): string {
  if (!iso) return "agora há pouco";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "agora" : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
}

const SOMBRA = "0 2px 12px rgba(0,0,0,.65)";

export function HeroClima({ t, cidade, decisao, janela, rede, atualizadoEm, carregando, onAtualizar }: {
  t: Tempo; cidade: string; decisao: Decisao; janela: Janela | null; rede: Rede | null; atualizadoEm: string | null; carregando: boolean; onAtualizar: () => void;
}) {
  const [toques, setToques] = useState(0);
  const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);
  const chovendo = t.estado === "chuva" || t.estado === "tempestade";
  const agora = t.horas[0] ? chanceDe(t.horas[0]) : 0;
  const cor = COR_NIVEL[decisao.nivel];
  const proxima = janela && decisao.nivel !== "bom" ? `${janela.amanha ? "amanhã " : ""}${janela.rotulo}` : null;
  return (
    <section className="relative overflow-hidden rounded-[26px] border" style={{ borderColor: "rgba(255,255,255,.08)", background: "#0e0e10", boxShadow: "0 30px 60px -30px rgba(0,0,0,.9)" }}>
      <CenaVant estado={t.estado} toques={toques} onToque={() => { haptic(); setToques((n) => n + 1); }}>
        <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
          <span className="cl-chip-agora cl-chip-cidade" style={{ color: "#f1ece3" }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} style={{ color: COR.ouro }} /><span>{cidade || "Sua região"} · GPS</span>
          </span>
          <button type="button" disabled={carregando} aria-label={`Atualizar clima (atualizado ${haQuanto(atualizadoEm)})`}
            onClick={(e) => { e.stopPropagation(); onAtualizar(); }}
            className="cl-chip-agora shrink-0 transition-transform duration-100 active:scale-[0.96] disabled:opacity-70" style={{ color: "#f1ece3" }}>
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />}
            {haQuanto(atualizadoEm)}
          </button>
        </div>
        <div className="absolute left-[18px] bottom-4 flex flex-col items-start gap-0.5 pointer-events-none" style={{ maxWidth: "52%" }}>
          <span className="font-extrabold leading-[.95] tracking-[-.03em] tabular-nums" style={{ fontSize: "clamp(46px,15vw,74px)", color: "#fff", textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>{Math.round(t.temp)}°</span>
          <span className="font-extrabold leading-tight" style={{ fontSize: "clamp(15px,4.4vw,18px)", color: "#fff", textShadow: SOMBRA }}>{t.condicao}</span>
          <span className="tabular-nums whitespace-nowrap" style={{ fontSize: "clamp(11.5px,3.3vw,13px)", color: "rgba(255,255,255,.88)", textShadow: SOMBRA }}>↑{r(t.max)} ↓{r(t.min)} · sensação {r(t.sensacao)}</span>
          <span className="cl-chip-agora mt-1.5 tabular-nums" style={{ color: chovendo || agora >= 50 ? CLIMA.chuvaLeve : "#f1ece3" }}>
            {chovendo ? "chovendo agora" : `chuva agora ${agora}%`}
          </span>
        </div>
      </CenaVant>

      {/* decisão minimalista (Rick, 08/10): um ponto de cor + a frase. */}
      <div className="px-[18px] pt-3.5 pb-4">
        <p className="flex items-center gap-2 text-[17px] font-bold leading-tight" style={{ color: COR.texto }}>
          <i className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} aria-hidden />
          {decisao.titulo}
        </p>
        <p className="text-[13px] mt-1 pl-4 leading-snug" style={{ color: "#a9a398" }}>
          {decisao.sub}{proxima && <> · próxima janela <b className="font-semibold tabular-nums" style={{ color: "#d8d3c9" }}>{proxima}</b></>}
        </p>
        {rede && rede.sim + rede.nao > 0 && (
          <p className="flex items-center gap-1.5 mt-3 text-[12.5px] font-semibold" style={{ color: "#c9c3b8" }}>
            <Users className="w-4 h-4 shrink-0" strokeWidth={2.2} style={{ color: COR.ouro }} />
            {rede.sim >= rede.nao
              ? `${rede.sim} ${rede.sim === 1 ? "vendedor perto confirmou" : "vendedores perto confirmaram"} chuva ${rede.minutos != null ? `há ${rede.minutos} min` : "agora"}`
              : `${rede.nao} ${rede.nao === 1 ? "vendedor perto disse" : "vendedores perto disseram"} que não está chovendo`}
          </p>
        )}
      </div>
    </section>
  );
}
