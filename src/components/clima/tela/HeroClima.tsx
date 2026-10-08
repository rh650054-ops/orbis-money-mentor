/* 1 · CLIMA AGORA — lugar, quando atualizou, temperatura, condição e a DECISÃO
   em destaque. O personagem é ambientação: fica no canto e nunca cobre texto. */
import { Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import type { Rede, Tempo } from "@/hooks/useClima";
import { chanceDe, COR_NIVEL, type Decisao } from "../decisao";
import { COR } from "./comum";
import { VantPersonagem } from "./VantPersonagem";

function haQuanto(iso: string | null): string {
  if (!iso) return "agora há pouco";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "agora" : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
}

export function HeroClima({ t, cidade, decisao, rede, atualizadoEm, carregando, onAtualizar }: {
  t: Tempo; cidade: string; decisao: Decisao; rede: Rede | null; atualizadoEm: string | null; carregando: boolean; onAtualizar: () => void;
}) {
  const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);
  const chovendo = t.estado === "chuva" || t.estado === "tempestade";
  const agora = t.horas[0] ? chanceDe(t.horas[0]) : null;
  const cor = COR_NIVEL[decisao.nivel];
  return (
    <section className="relative overflow-hidden rounded-[22px] border p-[18px]"
      style={{ background: "radial-gradient(120% 90% at 100% 0%, rgba(245,184,0,.10), transparent 55%), #0e0e10", borderColor: "rgba(255,255,255,.08)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 min-w-0 text-[13px] font-semibold" style={{ color: COR.sub }}>
          <MapPin className="w-4 h-4 shrink-0" strokeWidth={2.2} style={{ color: COR.ouro }} />
          <span className="truncate">{cidade || "Sua região"} · GPS</span>
        </span>
        <button type="button" onClick={onAtualizar} disabled={carregando} aria-label={`Atualizar clima (atualizado ${haQuanto(atualizadoEm)})`}
          className="-mr-2 h-9 pl-2 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold transition-[transform,background-color] duration-100 active:scale-[0.96] active:bg-white/[.06]"
          style={{ color: COR.mute }}>
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />}
          {haQuanto(atualizadoEm)}
        </button>
      </div>

      <div className="relative mt-2 pr-[92px] min-h-[132px]">
        <p className="text-[46px] leading-none font-extrabold tracking-tight tabular-nums" style={{ color: COR.texto }}>{Math.round(t.temp)}°</p>
        <p className="text-[18px] font-bold mt-1.5" style={{ color: COR.texto }}>{t.condicao}</p>
        <p className="text-[13px] mt-1 tabular-nums" style={{ color: COR.sub }}>sensação {r(t.sensacao)} · máx {r(t.max)} · mín {r(t.min)}</p>
        <p className="text-[14px] font-semibold mt-1.5 tabular-nums" style={{ color: chovendo || (agora ?? 0) >= 50 ? "#6FA8FF" : COR.sub }}>
          {chovendo ? "Chovendo agora" : `Chuva agora: ${agora ?? 0}%`}
        </p>
        <VantPersonagem estado={t.estado} altura={136} className="absolute -right-1 -bottom-2 pointer-events-none" />
      </div>

      <div className="mt-3 rounded-[16px] px-4 py-3" style={{ background: `${cor}14`, border: `1px solid ${cor}40` }}>
        <p className="text-[26px] leading-tight font-extrabold tracking-tight" style={{ color: cor }}>{decisao.titulo}</p>
        {decisao.sub && <p className="text-[13.5px] mt-1 leading-snug" style={{ color: COR.sub }}>{decisao.sub}</p>}
      </div>

      {rede && rede.sim + rede.nao > 0 && (
        <p className="flex items-center gap-1.5 mt-2.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}>
          <Users className="w-4 h-4 shrink-0" strokeWidth={2.2} style={{ color: COR.ouro }} />
          {rede.sim >= rede.nao
            ? `${rede.sim} ${rede.sim === 1 ? "vendedor perto confirmou" : "vendedores perto confirmaram"} chuva ${rede.minutos != null ? `há ${rede.minutos} min` : "agora"}`
            : `${rede.nao} ${rede.nao === 1 ? "vendedor perto disse" : "vendedores perto disseram"} que não está chovendo`}
        </p>
      )}
    </section>
  );
}
