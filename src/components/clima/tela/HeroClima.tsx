/* 1 · AGORA + DECISÃO (v4, 27/10/2026 — Rick: "tá tudo muito grande", referência
   o Clima do iPhone/Android). Sai a cena animada de meia tela (era 52% da altura do
   celular e a temperatura crescia com a largura: 46→74 px). Fica um cabeçalho
   compacto em px fixo: cidade, temperatura grande e fina, condição, máx/mín/sensação,
   o mascote pequeno ao lado; logo abaixo a decisão de venda num card. */
import { Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import type { Rede, Tempo } from "@/hooks/useClima";
import { COR_NIVEL, type Decisao, type Janela } from "../decisao";
import { CLIMA } from "./paleta";
import { probDaHora } from "./icone-tempo";
import { COR } from "./comum";
import { VantPersonagem } from "./VantPersonagem";

export function haQuanto(iso: string | null): string {
  if (!iso) return "agora há pouco";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "agora" : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
}

const r = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v)}°`);

export function HeroClima({ t, cidade, decisao, janela, rede, atualizadoEm, carregando, onAtualizar }: {
  t: Tempo; cidade: string; decisao: Decisao; janela: Janela | null; rede: Rede | null; atualizadoEm: string | null; carregando: boolean; onAtualizar: () => void;
}) {
  const cor = COR_NIVEL[decisao.nivel];
  const chovendo = t.estado === "chuva" || t.estado === "tempestade";
  const agora = t.horas[0] ? probDaHora(t.horas[0]) : 0;
  const proxima = janela && decisao.nivel !== "bom" ? `${janela.amanha ? "amanhã " : ""}${janela.rotulo}` : null;
  return (
    <section aria-label="Clima agora" className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-0.5 pt-1">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: COR.sub }}>
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} style={{ color: COR.ouro }} />
            <span className="truncate">{cidade || "Sua região"}</span>
          </p>
          <p className="mt-1 text-[64px] font-light leading-none tracking-[-.04em] tabular-nums" style={{ color: COR.texto }}>{Math.round(t.temp)}°</p>
          <p className="mt-1 text-[16px] font-semibold" style={{ color: COR.texto }}>{t.condicao}</p>
          <p className="mt-0.5 text-[13px] tabular-nums" style={{ color: COR.sub }}>Máx. {r(t.max)} · Mín. {r(t.min)} · sensação {r(t.sensacao)}</p>
        </div>
        <VantPersonagem altura={96} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-0.5">
        <button type="button" disabled={carregando} onClick={onAtualizar} aria-label="Atualizar o clima agora"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-transform duration-100 active:scale-[0.96] disabled:opacity-70"
          style={{ borderColor: COR.borda, background: COR.surface2, color: COR.sub }}>
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />}
          atualizado {haQuanto(atualizadoEm)}
        </button>
        <span className="inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold tabular-nums"
          style={{ borderColor: COR.borda, background: COR.surface2, color: chovendo || agora >= 50 ? CLIMA.chuvaLeve : COR.sub }}>
          {chovendo ? "chovendo agora" : `chuva agora ${agora}%`}
        </span>
        {t.fontesTotal > 0 && (
          <span className="inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold tabular-nums" style={{ borderColor: COR.borda, background: COR.surface2, color: COR.sub }}>
            <b className="mr-1" style={{ color: t.concordancia >= 80 ? COR_NIVEL.bom : COR_NIVEL.atencao }}>{t.concordancia}%</b> dos {t.fontesTotal} modelos concordam
          </span>
        )}
      </div>

      <div className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: "rgba(245,184,0,.35)", background: "linear-gradient(180deg,#151003,#111 70%)" }}>
        <p className="flex items-center gap-2 text-[16px] font-bold leading-tight" style={{ color: COR.texto }}>
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />
          {decisao.titulo}
        </p>
        <p className="mt-1 pl-4 text-[13px] leading-snug" style={{ color: COR.sub }}>
          {decisao.sub}{proxima && <> · próxima janela <b className="font-semibold tabular-nums" style={{ color: COR.texto }}>{proxima}</b></>}
        </p>
        {rede && rede.sim + rede.nao > 0 && (
          <p className="mt-2 flex items-center gap-1.5 pl-4 text-[12.5px] font-semibold" style={{ color: COR.sub }}>
            <Users className="h-4 w-4 shrink-0" strokeWidth={2.2} style={{ color: COR.ouro }} />
            {rede.sim >= rede.nao
              ? `${rede.sim} ${rede.sim === 1 ? "vendedor perto confirmou" : "vendedores perto confirmaram"} chuva ${rede.minutos != null ? `há ${rede.minutos} min` : "agora"}`
              : `${rede.nao} ${rede.nao === 1 ? "vendedor perto disse" : "vendedores perto disseram"} que não está chovendo`}
          </p>
        )}
      </div>
    </section>
  );
}
