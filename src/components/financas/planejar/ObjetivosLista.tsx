/* OBJETIVOS (antes "Caixinhas") — cada um com ícone, barra e o ritmo por dia. */
import { Plus, Target, Trophy } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Barra, COR, Cartao, Rotulo, haptic } from "./ui";
import type { ObjetivoVM } from "./tipos";

export function ObjetivosLista({ objetivos, onAbrir, onCriar }: { objetivos: ObjetivoVM[]; onAbrir: (id: string) => void; onCriar: () => void }) {
  const ativos = objetivos.filter((o) => !o.concluido).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <Rotulo cor={COR.texto}>Objetivos</Rotulo>
        {objetivos.length > 0 && <p className="text-[13px] mt-1" style={{ color: COR.sub }}>{ativos} {ativos === 1 ? "ativo" : "ativos"}</p>}
      </div>
      {objetivos.length > 0 && (
        <Cartao className="py-1.5">
          {objetivos.map((o) => (
            <button key={o.id} type="button" onClick={() => onAbrir(o.id)}
              className="w-full text-left py-4 border-t first:border-t-0 transition-colors active:bg-white/[.04]" style={{ borderColor: "rgba(255,255,255,.06)" }}>
              <span className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center overflow-hidden" style={{ background: "rgba(245,184,0,.1)" }}>
                  {o.foto ? <img src={o.foto} alt="" className="w-full h-full object-cover" />
                    : o.concluido ? <Trophy className="w-5 h-5" style={{ color: COR.verde }} strokeWidth={2} />
                    : <Target className="w-5 h-5" style={{ color: COR.ouro }} strokeWidth={2} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-semibold leading-snug" style={{ color: COR.texto }}>{o.nome}</span>
                  <span className="block text-[14px] tabular-nums" style={{ color: COR.sub }}>
                    <b style={{ color: COR.texto }}>{formatCurrency(o.tem)}</b> de {formatCurrency(o.alvo)}
                  </span>
                </span>
                <span className="text-[20px] font-bold tabular-nums shrink-0" style={{ color: o.concluido ? COR.verde : COR.ouro }}>{Math.round(o.pct)}%</span>
              </span>
              <span className="block mt-3"><Barra pct={o.pct} cor={o.concluido ? COR.verde : COR.ouro} altura={6} /></span>
              <span className="block text-[13px] mt-2 tabular-nums" style={{ color: COR.sub }}>
                {o.concluido ? "conquistado" : o.porDia > 0 ? `${formatCurrency(o.porDia)}/dia${o.prazoTexto ? ` · ${o.prazoTexto}` : ""}` : `faltam ${formatCurrency(Math.max(0, o.alvo - o.tem))}`}
              </span>
            </button>
          ))}
        </Cartao>
      )}
      <button type="button" onClick={() => { haptic(); onCriar(); }}
        className="w-full min-h-[52px] rounded-[16px] border flex items-center justify-center gap-2 text-[15px] font-bold transition-transform duration-100 active:scale-[0.98]"
        style={{ background: COR.surface, borderColor: "rgba(245,184,0,.3)", color: COR.ouro }}>
        <Plus className="w-5 h-5" strokeWidth={2.4} />{objetivos.length === 0 ? "Criar meu primeiro objetivo" : "Criar objetivo"}
      </button>
    </div>
  );
}
