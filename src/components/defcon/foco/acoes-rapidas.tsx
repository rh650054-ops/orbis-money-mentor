/* Atalho do mercado no Foco (Rick, 19/10): no lugar de "Comprar mercadoria / Atualizar
   estoque / Ajustar ontem", um botão só — o "Tô no mercado" de Produtos, que já sabe os
   insumos salvos, faz item por item ou só o total e sobe o estoque sozinho.
   Abre como tela cheia (nada de folha + teclado subindo junto). */
import { ChevronRight, ShoppingCart } from "lucide-react";
import { PRESS } from "./foco-tipos";

export function AcoesRapidas({ onMercado }: { onMercado: () => void }) {
  return (
    <section className="mt-6 px-0.5" aria-label="Tô no mercado">
      <button type="button" onClick={onMercado}
        className={`w-full h-[68px] rounded-[18px] flex items-center gap-3 px-4 text-left ${PRESS}`}
        style={{ border: "1px solid rgba(245,184,0,.35)", background: "linear-gradient(170deg,#1a1305,var(--orbis-surf) 70%)" }}>
        <span className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: "var(--orbis-gold)" }}>
          <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.4} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold">Tô no mercado</span>
          <span className="block text-[12px] font-semibold truncate" style={{ color: "var(--orbis-fg-3)" }}>anota a compra · o estoque sobe sozinho</span>
        </span>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--orbis-gold)" }} />
      </button>
    </section>
  );
}
