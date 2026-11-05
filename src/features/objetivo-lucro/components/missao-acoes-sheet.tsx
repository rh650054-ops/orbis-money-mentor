/* Toque na faixa da missão no Foco (Rick, 29/10/2026): "a missão pode ser editada e apagada
   quando eu clico em cima dela". Abre o card completo (progresso, plano, Abortar) e
   "Editar missão", que refaz a missão no fluxo de sempre — a nova substitui a atual.
   01/11: "Ver o dia a dia" abre o calendário do plano (acompanhar dia após dia). */
import { useState } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { useDesafioAtualQuery } from "../api/use-objetivo-lucro";
import { DesafioCard } from "./desafio-card";
import { DiaADia } from "./dia-a-dia";
import { DiaDetalheSheet } from "./dia-detalhe-sheet";
import { faturamentoDoPlano } from "../lib/missao-dias";
import { brl0 } from "../lib/formato";
import { COR, PRESS } from "./ui";

export function MissaoAcoesSheet({ open, onOpenChange, onEditar }: { open: boolean; onOpenChange: (o: boolean) => void; onEditar: () => void }) {
  const { data: d } = useDesafioAtualQuery();
  const [verDias, setVerDias] = useState(false);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);  // 05/11: tap a day card
  const temPlano = !!d && d.plano.length > 0;
  return (
    <Gaveta open={open} onOpenChange={onOpenChange} titulo="Sua missão" style={{ background: COR.fundo, borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1 space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground">Sua missão</h3>
        {d && temPlano && (
          <div className="rounded-[16px] px-4 py-3 flex items-center justify-between gap-3" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
            <span className="min-w-0">
              <span className="block orbis-section" style={{ color: COR.mute }}>Faturar no período</span>
              <span className="block text-[11.5px] mt-0.5" style={{ color: COR.sub }}>pra sobrar {brl0(d.alvo)} no bolso</span>
            </span>
            <span className="vant-missao-num text-[28px] leading-none shrink-0" style={{ color: COR.texto }}>{brl0(faturamentoDoPlano(d.plano, d.custo_unid, d.lucro_unid))}</span>
          </div>
        )}
        {d ? <DesafioCard /> : <p className="text-[13px]" style={{ color: COR.sub }}>A missão foi apagada. A meta do dia volta a seguir o seu planejamento.</p>}
        {temPlano && (
          <button type="button" onClick={() => setVerDias((v) => !v)}
            className={`w-full h-[48px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black ${PRESS}`}
            style={{ color: COR.ouro, border: "1px solid rgba(245,184,0,.45)", background: "rgba(245,184,0,.08)" }}>
            <CalendarDays className="w-4 h-4" /> {verDias ? "Esconder o dia a dia" : "Ver o dia a dia"}
          </button>
        )}
        {temPlano && verDias && d && <DiaADia d={d} onDia={setDiaAberto} />}
        {d && <DiaDetalheSheet d={d} dia={diaAberto} onFechar={() => setDiaAberto(null)} />}
        <button type="button" onClick={() => { onOpenChange(false); onEditar(); }}
          className={`w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black ${PRESS}`}
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
          <Pencil className="w-4 h-4" /> {d ? "Editar missão" : "Criar nova missão"}
        </button>
        {d && <p className="text-[11px] text-center leading-snug" style={{ color: COR.mute }}>Editar refaz a missão com valor, prazo e dias novos. A nova substitui esta.</p>}
      </div>
    </Gaveta>
  );
}
