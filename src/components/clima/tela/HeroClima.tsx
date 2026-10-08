/* 1 · CLIMA AGORA + DECISÃO — hero atmosférico (v2, 08/10).
   O fundo reage ao céu (azul petróleo na chuva, roxo no temporal, dourado sutil
   no sol, azul-marinho à noite), com gotas discretas quando chove. O personagem
   ocupa ~26% da largura e nunca cobre texto. A decisão vem em caixa alta. */
import { Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import type { Rede, Tempo } from "@/hooks/useClima";
import { chanceDe, COR_NIVEL, type Decisao, type Janela } from "../decisao";
import { COR } from "./comum";
import { ATMOSFERA, CLIMA } from "./paleta";
import { VantPersonagem } from "./VantPersonagem";
import { poseDe } from "./visual";

function haQuanto(iso: string | null): string {
  if (!iso) return "agora há pouco";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "agora" : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
}

const GOTAS = Array.from({ length: 22 }, (_, i) => ({ x: (i * 37) % 100, d: 0.7 + ((i * 13) % 7) / 10, a: -((i * 17) % 20) / 10, h: 10 + ((i * 7) % 12) }));

export function HeroClima({ t, cidade, decisao, janela, rede, atualizadoEm, carregando, onAtualizar }: {
  t: Tempo; cidade: string; decisao: Decisao; janela: Janela | null; rede: Rede | null; atualizadoEm: string | null; carregando: boolean; onAtualizar: () => void;
}) {
  const r = (v: number | null) => (v == null ? "–" : `${Math.round(v)}°`);
  const chovendo = t.estado === "chuva" || t.estado === "tempestade";
  const agora = t.horas[0] ? chanceDe(t.horas[0]) : 0;
  const cor = COR_NIVEL[decisao.nivel];
  const atm = ATMOSFERA[t.estado];
  const proxima = janela && decisao.nivel !== "bom" ? `${janela.amanha ? "amanhã " : ""}${janela.rotulo}` : null;
  return (
    <section className="relative overflow-hidden rounded-[24px] border p-[18px]" style={{ borderColor: "rgba(255,255,255,.08)", background: "#0b0b0d" }}>
      {/* atmosfera: crossfade quando o céu muda */}
      <div key={t.estado} className="absolute inset-0 animate-in fade-in duration-500" style={{ background: atm.fundo }} aria-hidden />
      <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: atm.brilho }} aria-hidden />
      {chovendo && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {GOTAS.map((g, i) => (
            <span key={i} className="hero-gota absolute w-px rounded-full"
              style={{ left: `${g.x}%`, top: -20, height: g.h, background: "linear-gradient(transparent, rgba(156,196,255,.55))", animation: `hero-gota ${g.d}s linear ${g.a}s infinite` }} />
          ))}
          <style>{"@keyframes hero-gota { from { transform: translateY(0) } to { transform: translateY(420px) } } @media (prefers-reduced-motion: reduce) { .hero-gota { animation: none !important; opacity: .4 } }"}</style>
        </div>
      )}

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 min-w-0 text-[13px] font-semibold" style={{ color: "#d8d3c9" }}>
            <MapPin className="w-4 h-4 shrink-0" strokeWidth={2.2} style={{ color: COR.ouro }} />
            <span className="truncate">{cidade || "Sua região"} · GPS</span>
          </span>
          <button type="button" onClick={onAtualizar} disabled={carregando} aria-label={`Atualizar clima (atualizado ${haQuanto(atualizadoEm)})`}
            className="-mr-2 h-9 pl-2 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold transition-[transform,background-color] duration-100 active:scale-[0.96] hover:bg-white/[.06]"
            style={{ color: "#b3ada3" }}>
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />}
            {haQuanto(atualizadoEm)}
          </button>
        </div>

        <div className="relative mt-1 pr-[96px] min-h-[150px]">
          <p className="text-[48px] leading-none font-extrabold tracking-tight tabular-nums mt-2" style={{ color: COR.texto }}>{Math.round(t.temp)}°</p>
          <p className="text-[19px] font-bold mt-1.5" style={{ color: COR.texto }}>{t.condicao}</p>
          <p className="text-[13px] mt-1 tabular-nums" style={{ color: "#c9c3b8" }}>sensação {r(t.sensacao)} · máx {r(t.max)} · mín {r(t.min)}</p>
          <p className="inline-flex items-center gap-1.5 text-[14px] font-bold mt-2 tabular-nums rounded-full px-2.5 h-7"
            style={{ color: chovendo || agora >= 50 ? CLIMA.chuvaLeve : "#d8d3c9", background: chovendo || agora >= 50 ? "rgba(91,155,255,.16)" : "rgba(255,255,255,.06)" }}>
            {chovendo ? "chovendo agora" : `chuva agora ${agora}%`}
          </p>
          <VantPersonagem estado={t.estado} pose={poseDe(t.estado, decisao.nivel === "bom")} altura={150} className="absolute -right-2 -bottom-3 pointer-events-none" />
        </div>

        <div className="mt-4 rounded-[18px] px-4 py-3.5 backdrop-blur-sm" style={{ background: "rgba(10,10,12,.55)", border: `1px solid ${cor}55`, boxShadow: `0 0 30px -12px ${cor}88` }}>
          <p className="text-[27px] leading-[1.05] font-black uppercase tracking-tight" style={{ color: cor }}>{decisao.titulo}</p>
          {decisao.sub && <p className="text-[14px] mt-1.5 leading-snug" style={{ color: "#d8d3c9" }}>{decisao.sub}</p>}
          {proxima && (
            <p className="mt-2.5 pt-2.5 border-t flex items-baseline justify-between gap-2" style={{ borderColor: "rgba(255,255,255,.08)" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#b3ada3" }}>Próxima janela</span>
              <span className="text-[18px] font-extrabold tabular-nums" style={{ color: CLIMA.bom }}>{proxima}</span>
            </p>
          )}
        </div>

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
