/* Ações rápidas: 4 atalhos logo abaixo do DEFCON (linha de atalhos do Nubank / quick
   actions do iOS). Amarelo = ação do dia; cinza-azulado = utilitário. */
import { Calendar, Package, Plus, ShoppingCart } from "lucide-react";
import { PRESS } from "./foco-tipos";

interface Props {
  onLancarCusto: () => void;
  onComprar: () => void;
  onEstoque: () => void;
  onAjustarOntem: () => void;
}

export function AcoesRapidas({ onLancarCusto, onComprar, onEstoque, onAjustarOntem }: Props) {
  const itens = [
    { k: "custo", label: ["Lançar", "custo"], Icon: Plus, on: onLancarCusto, neutro: false },
    { k: "compra", label: ["Comprar", "mercadoria"], Icon: ShoppingCart, on: onComprar, neutro: false },
    { k: "estoque", label: ["Atualizar", "estoque"], Icon: Package, on: onEstoque, neutro: false },
    { k: "ontem", label: ["Ajustar", "ontem"], Icon: Calendar, on: onAjustarOntem, neutro: true },
  ];
  return (
    <section className="mt-6 px-0.5" aria-label="Ações rápidas">
      <p className="orbis-mini">Ações rápidas</p>
      <div className="grid grid-cols-4 gap-2 mt-2.5">
        {itens.map(({ k, label, Icon, on, neutro }) => (
          <button key={k} type="button" onClick={on}
            className={`h-[76px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 text-[11.5px] font-bold leading-[1.1] text-center ${PRESS}`}
            style={{ border: "1px solid var(--orbis-line)", background: "var(--orbis-surf)", color: "var(--orbis-fg-2)" }}>
            <span className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center"
              style={neutro ? { background: "rgba(143,163,184,.12)", color: "#8fa3b8" } : { background: "rgba(245,184,0,.13)", color: "var(--orbis-gold)" }}>
              <Icon className="w-4 h-4" strokeWidth={2.4} />
            </span>
            <span>{label[0]}<br />{label[1]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
