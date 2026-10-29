/* Toque na faixa da missão no Foco (Rick, 29/10/2026): "a missão pode ser editada e apagada
   quando eu clico em cima dela". Abre o card completo (progresso, plano, Abortar) e
   "Editar missão", que refaz a missão no fluxo de sempre — a nova substitui a atual. */
import { Pencil } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { useDesafioAtualQuery } from "../api/use-objetivo-lucro";
import { DesafioCard } from "./desafio-card";
import { COR, PRESS } from "./ui";

export function MissaoAcoesSheet({ open, onOpenChange, onEditar }: { open: boolean; onOpenChange: (o: boolean) => void; onEditar: () => void }) {
  const { data: d } = useDesafioAtualQuery();
  return (
    <Gaveta open={open} onOpenChange={onOpenChange} titulo="Sua missão" style={{ background: COR.fundo, borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1 space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground">Sua missão</h3>
        {d ? <DesafioCard /> : <p className="text-[13px]" style={{ color: COR.sub }}>A missão foi apagada. A meta do dia volta a seguir o seu planejamento.</p>}
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
