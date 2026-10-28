/* 6 · Precisa de revisão: unknown movements get their own block, never lost in the list. */
import { HelpCircle } from "lucide-react";
import { BotaoPrimario, Cartao, COR } from "@/components/financas/planejar/ui";
import { Titulo, inteiro } from "./pecas";

export function PrecisaRevisao({ qtd, total, perguntas, onRevisar, onPerguntas }: {
  qtd: number; total: number; perguntas: number; onRevisar: () => void; onPerguntas: () => void;
}) {
  if (qtd === 0 && perguntas === 0) return null;
  return (
    <section aria-label="Precisa de revisão">
      <Titulo>Precisa de revisão</Titulo>
      <Cartao style={{ borderColor: "rgba(245,184,0,.35)" }}>
        {qtd > 0 && (
          <>
            <p className="text-[15px] font-bold" style={{ color: COR.texto }}>
              {qtd} {qtd === 1 ? "movimentação" : "movimentações"}{total > 0 ? ` · ${inteiro(total)}` : ""}
            </p>
            <p className="text-[12.5px] mt-0.5 mb-3" style={{ color: COR.mute }}>A Vant não teve certeza da categoria. Um toque em cada uma resolve.</p>
            <BotaoPrimario onClick={onRevisar}>Revisar agora</BotaoPrimario>
          </>
        )}
        {perguntas > 0 && (
          <button type="button" onClick={onPerguntas}
            className="mt-2 w-full min-h-11 flex items-center gap-2 text-[14px] font-bold rounded-[12px] transition-colors active:bg-white/[.05]" style={{ color: COR.ouro }}>
            <HelpCircle className="w-4 h-4" /> {perguntas} {perguntas === 1 ? "pergunta" : "perguntas"} da Vant sobre o mês
          </button>
        )}
      </Cartao>
    </section>
  );
}
