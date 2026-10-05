/* OBJETIVOS (antes "Caixinhas") — compacto: ícone, valor, %, barra fina e o ritmo por dia. */
import { Plus, Target, Trophy } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Barra, COR, Cartao, Rotulo, haptic } from "./ui";
import type { ObjetivoVM } from "./tipos";

export function ObjetivosLista({ objetivos, onAbrir, onCriar }: { objetivos: ObjetivoVM[]; onAbrir: (id: string) => void; onCriar: () => void }) {
  const ativos = objetivos.filter((o) => !o.concluido).length;
  const criar = (
    <button type="button" onClick={() => { haptic(); onCriar(); }}
      className="w-full h-11 flex items-center gap-2 text-[13.5px] font-extrabold rounded-[10px] transition-[transform,background-color] duration-100 active:scale-[0.98] active:bg-white/[.04]"
      style={{ color: COR.ouro }}>
      <Plus className="w-4 h-4" strokeWidth={2.8} />{objetivos.length === 0 ? "Criar meu primeiro objetivo" : "Criar objetivo"}
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="px-1">
        <Rotulo cor={COR.texto}>Objetivos</Rotulo>
        {objetivos.length > 0 && <p className="text-[13px] mt-0.5" style={{ color: COR.mute }}>{ativos} {ativos === 1 ? "ativo" : "ativos"}</p>}
      </div>
      <Cartao className="py-1">
        {objetivos.map((o) => (
          <button key={o.id} type="button" onClick={() => onAbrir(o.id)}
            className="w-full text-left py-3 border-b transition-colors active:bg-white/[.04]" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] shrink-0 flex items-center justify-center overflow-hidden" style={{ background: "rgba(245,184,0,.1)" }}>
                {o.foto ? <img src={o.foto} alt="" className="w-full h-full object-cover" />
                  : o.concluido ? <Trophy className="w-4 h-4" style={{ color: COR.verde }} strokeWidth={2.2} />
                  : <Target className="w-4 h-4" style={{ color: COR.ouro }} strokeWidth={2.2} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold truncate" style={{ color: COR.texto }}>{o.nome}</span>
                  <span className="text-[17px] font-extrabold tabular-nums shrink-0" style={{ color: o.concluido ? COR.verde : COR.ouro }}>{Math.round(o.pct)}%</span>
                </span>
                <span className="block text-[12.5px] mt-0.5 tabular-nums" style={{ color: COR.sub }}><b style={{ color: COR.texto }}>{formatCurrency(o.tem)}</b> de {formatCurrency(o.alvo)}</span>
                <span className="block mt-1.5"><Barra pct={o.pct} cor={o.concluido ? COR.verde : COR.ouro} altura={4} /></span>
                <span className="block text-[12px] mt-1 tabular-nums truncate" style={{ color: COR.mute }}>
                  {o.concluido ? "conquistado" : o.porDia > 0 ? `${formatCurrency(o.porDia)}/dia${o.prazoTexto ? ` · ${o.prazoTexto}` : ""}` : `faltam ${formatCurrency(Math.max(0, o.alvo - o.tem))}`}
                </span>
              </span>
            </span>
          </button>
        ))}
        {criar}
      </Cartao>
    </div>
  );
}
