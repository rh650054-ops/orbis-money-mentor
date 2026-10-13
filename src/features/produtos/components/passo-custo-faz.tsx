/* Passo 3 (eu mesmo faço) — monta a receita (recomendado: ela é salva e alimenta o
   "Tô no mercado"), "sei mais ou menos" (leva ÷ rendimento) ou descobrir depois. */
import { useState } from "react";
import { custoPorUnidade } from "../lib/conta";
import { ingredientesSugeridos, receitaDoRascunho, totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import type { ItemReceita } from "../types";
import { CampoDinheiro, Contador, reais } from "./campos";
import { EditorReceita } from "./editor-receita";
import { BotaoOuro, QuizCasca, ResultadoOuro } from "./quiz-casca";

const CARD = { background: "#0f0f10", border: "1px solid #26241f" };
const OURO_BORDA = { border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" };

export function PassoCustoFaz({ nome, custo, total, receitaInicial, rendeInicial, onCusto, onRende, onReceita, onContinuar, onVoltar }: {
  nome: string; custo: number; total: number; receitaInicial: IngredienteRascunho[] | null; rendeInicial: number;
  onCusto: (n: number) => void; onRende: (n: number) => void;
  onReceita: (r: ItemReceita[] | null, rende: number) => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const [caminho, setCaminho] = useState<null | "sei" | "receita">(receitaInicial ? "receita" : null);
  const [gasto, setGasto] = useState(0);
  const [rende, setRende] = useState(rendeInicial > 0 ? rendeInicial : 20);
  const [itens, setItens] = useState<IngredienteRascunho[]>(() => receitaInicial ?? ingredientesSugeridos(nome, rendeInicial > 0 ? rendeInicial : 20));
  const voltar = () => (caminho ? setCaminho(null) : onVoltar());

  if (!caminho) {
    return (
      <QuizCasca passo={3} total={total} onVoltar={onVoltar} titulo={`Como você faz ${nome}?`}
        sub="Com a sua receita, a VANT calcula o custo e sabe quantas saem de cada compra do mercado." rodape={null}>
        <div className="flex flex-col gap-3 mt-3">
          <button type="button" onClick={() => setCaminho("receita")} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={OURO_BORDA}>
            <span className="text-[17px] font-black">Montar minha receita</span>
            <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>"1 leite condensado + 1 creme de leite rende 20." Preço é opcional.</span>
          </button>
          {custo > 0 && (
            <button type="button" onClick={() => { onReceita(null, 0); onContinuar(); }} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={CARD}>
              <span className="text-[17px] font-black">Manter {reais(custo)} cada</span>
              <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>O custo que já está salvo.</span>
            </button>
          )}
          <button type="button" onClick={() => setCaminho("sei")} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={CARD}>
            <span className="text-[17px] font-black">Só sei o gasto, mais ou menos</span>
            <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>"Gasto uns R$ 48 e sai umas 30"</span>
          </button>
          <button type="button" onClick={() => { onCusto(0); onReceita(null, 0); onContinuar(); }} className="rounded-[20px] p-4 text-left flex flex-col gap-1" style={{ background: "#0f0f10", border: "1px dashed #3a3833" }}>
            <span className="text-[15px] font-extrabold" style={{ color: "#d8d2c4" }}>Descobrir depois</span>
            <span className="text-xs" style={{ color: "#7b766e" }}>Salva sem custo. Você completa na ficha do produto.</span>
          </button>
        </div>
      </QuizCasca>
    );
  }

  if (caminho === "sei") {
    const conta = (g: number, r: number) => { onCusto(custoPorUnidade(g, r)); onRende(r); onReceita(null, 0); };
    return (
      <QuizCasca passo={3} total={total} onVoltar={voltar} titulo="Quanto você gasta numa leva?"
        sub="Tudo que vai: ingredientes, embalagem, gás. Pode ser aproximado."
        rodape={<BotaoOuro onClick={onContinuar} disabled={!(custo > 0)}>CONTINUAR</BotaoOuro>}>
        <CampoDinheiro rotulo="Gasto na leva" valor={gasto} onChange={(g) => { setGasto(g); conta(g, rende); }} autoFocus />
        <Contador rotulo="Quantas saem" valor={rende} min={1} onChange={(r) => { setRende(r); conta(gasto, r); }} />
        {custo > 0 && <ResultadoOuro rotulo="Cada uma te custa" valor={reais(custo)} />}
      </QuizCasca>
    );
  }

  const aplicar = (novos: IngredienteRascunho[], r: number) => {
    setItens(novos); setRende(r);
    onCusto(custoPorUnidade(totalDaReceita(novos), r));
    onRende(r);
    onReceita(receitaDoRascunho(novos), r);
  };
  const valida = receitaDoRascunho(itens).length > 0 && rende >= 1;
  return (
    <QuizCasca passo={3} total={total} onVoltar={voltar} titulo={`O que vai em ${nome}?`}
      sub="Quanto de cada coisa vai numa leva. Já marcamos o comum: ajusta do seu jeito."
      rodape={<BotaoOuro onClick={() => { aplicar(itens, rende); onContinuar(); }} disabled={!valida}>CONTINUAR</BotaoOuro>}>
      <EditorReceita itens={itens} rende={rende} onItens={(n) => aplicar(n, rende)} onRende={(r) => aplicar(itens, r)} />
    </QuizCasca>
  );
}
