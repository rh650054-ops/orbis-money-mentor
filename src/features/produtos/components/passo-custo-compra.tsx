/* Passo 3 (compra pronto) — "Quanto você paga?": pacote ÷ unidades, ou o preço de 1. */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { custoPorUnidade } from "../lib/conta";
import { CampoDinheiro, Contador, DuasAbas, reais } from "./campos";
import { BotaoOuro, QuizCasca, ResultadoOuro } from "./quiz-casca";

export function PassoCustoCompra({ nome, custo, total, onCusto, onPacote, onFaco, onContinuar, onVoltar }: {
  nome: string; custo: number; total: number;
  onCusto: (n: number) => void; onPacote: (unidades: number) => void;
  onFaco: () => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const [modo, setModo] = useState<"pacote" | "unidade">(custo > 0 ? "unidade" : "pacote");
  const [pago, setPago] = useState(0);
  const [qtd, setQtd] = useState(12);
  const doPacote = (p: number, q: number) => { setPago(p); setQtd(q); onCusto(custoPorUnidade(p, q)); onPacote(q); };

  return (
    <QuizCasca passo={3} total={total} onVoltar={onVoltar}
      titulo={`Quanto você paga no ${nome}?`} sub="O que sai do seu bolso pra ter o produto."
      rodape={<BotaoOuro onClick={onContinuar} disabled={!(custo > 0)}>CONTINUAR</BotaoOuro>}>
      <DuasAbas valor={modo} onChange={setModo} opcoes={[["pacote", "Comprei em pacote"], ["unidade", "Sei o preço de 1"]]} />
      {modo === "pacote" ? (
        <div className="flex flex-col gap-2.5">
          <CampoDinheiro rotulo="Quanto pagou no pacote" valor={pago} onChange={(p) => doPacote(p, qtd)} autoFocus />
          <Contador rotulo="Quantas vêm no pacote" valor={qtd} min={1} onChange={(q) => doPacote(pago, q)} />
        </div>
      ) : (
        <CampoDinheiro key="un" rotulo="Quanto pagou em 1" valor={custo} onChange={onCusto} autoFocus />
      )}
      {custo > 0 && <ResultadoOuro rotulo="Cada um te custa" valor={reais(custo)} />}
      <button type="button" onClick={onFaco} className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-left"
        style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
        <span className="text-lg">👩‍🍳</span>
        <span className="flex-1 text-[13px] font-extrabold">Eu mesmo faço esse produto</span>
        <ChevronRight className="w-4 h-4" style={{ color: "#7b766e" }} />
      </button>
    </QuizCasca>
  );
}
