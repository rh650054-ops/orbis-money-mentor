/* Question 2 — "Como você consegue esse produto?" decides the path. 22/11 (Etapa 2): three answers.
   Only "Eu mesmo produzo" asks for a recipe; resale stock grows through the purchase record; "depois"
   saves the product sellable, with nothing that feeds automatic production. */
import { ChevronRight } from "lucide-react";
import { VANT } from "../lib/visual";
import { QuizCasca } from "./quiz-casca";

type Origem = "compra" | "faz" | null;

function Opcao({ emoji, titulo, sub, exemplos, destaque, tracejado, onClick }: {
  emoji: string; titulo: string; sub: string; exemplos?: string; destaque?: boolean; tracejado?: boolean; onClick: () => void;
}) {
  const estilo = destaque
    ? { border: "1px solid transparent", background: `linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,${VANT.ouro}) border-box` }
    : { background: VANT.cartao, border: `1px ${tracejado ? "dashed" : "solid"} ${VANT.borda}` };
  return (
    <button type="button" onClick={onClick} className="rounded-[20px] px-4 py-[18px] min-h-[88px] flex gap-3.5 items-center text-left active:scale-[.99] transition-transform" style={estilo}>
      <span className="w-[54px] h-[54px] rounded-2xl shrink-0 flex items-center justify-center text-[22px]" style={{ background: "#1f1f1f" }}>{emoji}</span>
      <span className="flex-1 flex flex-col gap-1">
        <span className="text-[17px] font-black" style={{ color: VANT.texto }}>{titulo}</span>
        <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>{sub}</span>
        {exemplos && <span className="text-[11.5px] font-bold" style={{ color: VANT.cinza }}>{exemplos}</span>}
      </span>
      <ChevronRight className="w-5 h-5" style={{ color: VANT.cinza }} />
    </button>
  );
}

export function PassoOrigem({ onEscolher, onVoltar, total }: {
  onEscolher: (o: Origem) => void; onVoltar: () => void; total: number;
}) {
  return (
    <QuizCasca passo={2} total={total} onVoltar={onVoltar}
      titulo="Como você consegue esse produto?" sub="Assim a VANT sabe calcular seu custo e o seu estoque."
      rodape={<p className="text-center text-xs font-bold" style={{ color: VANT.cinza }}>Você muda isso depois, na ficha do produto.</p>}>
      <div className="flex flex-col gap-3 mt-3">
        <Opcao emoji="👩‍🍳" titulo="Eu mesmo produzo" sub="Faço com ingredientes. A receita calcula custo e produção." exemplos="batida, trufa, brigadeiro, salgado" destaque onClick={() => onEscolher("faz")} />
        <Opcao emoji="📦" titulo="Compro pronto para revender" sub="Atacado, distribuidora ou mercado. Não precisa de receita." exemplos="água, bala, refri, chocolate" onClick={() => onEscolher("compra")} />
        <Opcao emoji="⏳" titulo="Configurar depois" sub="Salva o produto e já dá pra vender. Custo e produção ficam pra quando você completar." tracejado onClick={() => onEscolher(null)} />
      </div>
    </QuizCasca>
  );
}
