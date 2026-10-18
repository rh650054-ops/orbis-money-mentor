/* Ações rápidas: 3 atalhos logo abaixo do DEFCON (linha de atalhos do Nubank / quick
   actions do iOS) — só o que NÃO tem outro lugar na tela: compra (sheet), carga de hoje
   e o dia de ontem. Custo rápido já está logo abaixo, então não repete aqui.
   Amarelo = ação do dia; cinza-azulado = utilitário. */
import { Calendar, Package, ShoppingCart } from "lucide-react";
import { PRESS } from "./foco-tipos";

interface Props {
  onComprar: () => void;
  onEstoque: () => void;
  onAjustarOntem: () => void;
}

export function AcoesRapidas({ onComprar, onEstoque, onAjustarOntem }: Props) {
  const itens = [
    { k: "compra", label: ["Comprar", "mercadoria"], Icon: ShoppingCart, on: onComprar, neutro: false },
    { k: "estoque", label: ["Atualizar", "estoque"], Icon: Package, on: onEstoque, neutro: false },
    { k: "ontem", label: ["Ajustar", "ontem"], Icon: Calendar, on: onAjustarOntem, neutro: true },
  ];
  return (
    <section className="mt-6 px-0.5" aria-label="Ações rápidas">
      <p className="orbis-mini">Ações rápidas</p>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
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
