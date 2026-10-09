/* Passo 2 — "Como você consegue esse produto?" decide o caminho do custo. */
import { ChevronRight } from "lucide-react";
import { QuizCasca } from "./quiz-casca";

function Opcao({ emoji, titulo, sub, exemplos, destaque, onClick }: {
  emoji: string; titulo: string; sub: string; exemplos: string; destaque?: boolean; onClick: () => void;
}) {
  const estilo = destaque
    ? { border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" }
    : { background: "#0f0f10", border: "1px solid #26241f" };
  return (
    <button type="button" onClick={onClick} className="rounded-[20px] px-4 py-[18px] flex gap-3.5 items-center text-left" style={estilo}>
      <span className="w-[54px] h-[54px] rounded-2xl shrink-0 flex items-center justify-center text-[26px]" style={{ background: "#1a1a19" }}>{emoji}</span>
      <span className="flex-1 flex flex-col gap-1">
        <span className="text-[17px] font-black">{titulo}</span>
        <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>{sub}</span>
        <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>{exemplos}</span>
      </span>
      <ChevronRight className="w-5 h-5" style={{ color: "#7b766e" }} />
    </button>
  );
}

export function PassoOrigem({ onEscolher, onVoltar, total }: {
  onEscolher: (o: "compra" | "faz") => void; onVoltar: () => void; total: number;
}) {
  return (
    <QuizCasca passo={2} total={total} onVoltar={onVoltar}
      titulo="Como você consegue esse produto?" sub="Assim a VANT sabe como calcular seu custo."
      rodape={<p className="text-center text-xs font-bold" style={{ color: "#7b766e" }}>Você muda isso depois, se precisar.</p>}>
      <div className="flex flex-col gap-3 mt-3">
        <Opcao emoji="📦" titulo="Compro pronto" sub="No atacado, distribuidora ou mercado." exemplos="água, bala, refri, chocolate" onClick={() => onEscolher("compra")} />
        <Opcao emoji="👩‍🍳" titulo="Eu mesmo faço" sub="Faço em casa com ingredientes." exemplos="batida, trufa, brigadeiro, salgado" destaque onClick={() => onEscolher("faz")} />
      </div>
    </QuizCasca>
  );
}
