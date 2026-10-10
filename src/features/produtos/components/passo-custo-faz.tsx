/* Passo 3 (eu mesmo faço) — sabe o custo? Sei (leva ÷ rendimento), não sei
   (a VANT calcula pela receita) ou descobrir depois (salva sem custo). */
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { custoPorUnidade } from "../lib/conta";
import { ingredientesSugeridos, totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import { CampoDinheiro, Contador, reais } from "./campos";
import { BotaoOuro, QuizCasca, ResultadoOuro } from "./quiz-casca";

const CARD = { background: "#0f0f10", border: "1px solid #26241f" };
const OURO_BORDA = { border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" };

export function PassoCustoFaz({ nome, custo, total, onCusto, onRende, onContinuar, onVoltar }: {
  nome: string; custo: number; total: number;
  onCusto: (n: number) => void; onRende: (n: number) => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const [caminho, setCaminho] = useState<null | "sei" | "naosei">(null);
  const [gasto, setGasto] = useState(0);
  const [rende, setRende] = useState(30);
  const [itens, setItens] = useState<IngredienteRascunho[]>(() => ingredientesSugeridos(nome));
  const conta = (total: number, r: number) => { onCusto(custoPorUnidade(total, r)); onRende(r); };
  const voltar = () => (caminho ? setCaminho(null) : onVoltar());

  if (!caminho) {
    return (
      <QuizCasca passo={3} total={total} onVoltar={onVoltar} titulo={`Você sabe quanto gasta pra fazer ${nome}?`}
        sub="Sem problema se não souber. A maioria não sabe, e a VANT descobre com você." rodape={null}>
        <div className="flex flex-col gap-3 mt-3">
          {custo > 0 && (
            <button type="button" onClick={onContinuar} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={CARD}>
              <span className="text-[17px] font-black">Manter {reais(custo)} cada</span>
              <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>O custo que já está salvo.</span>
            </button>
          )}
          <button type="button" onClick={() => setCaminho("sei")} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={CARD}>
            <span className="text-[17px] font-black">Sei, mais ou menos</span>
            <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>"Gasto uns R$ 48 e sai umas 30"</span>
          </button>
          <button type="button" onClick={() => setCaminho("naosei")} className="rounded-[20px] px-4 py-[18px] text-left flex flex-col gap-1" style={OURO_BORDA}>
            <span className="text-[17px] font-black">Não sei · me ajuda a calcular</span>
            <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>Você diz o que vai na receita, a VANT faz a conta.</span>
          </button>
          <button type="button" onClick={() => { onCusto(0); onContinuar(); }} className="rounded-[20px] p-4 text-left flex flex-col gap-1" style={{ background: "#0f0f10", border: "1px dashed #3a3833" }}>
            <span className="text-[15px] font-extrabold" style={{ color: "#d8d2c4" }}>Descobrir depois</span>
            <span className="text-xs" style={{ color: "#7b766e" }}>Salva sem custo. Você completa quando lançar a próxima compra.</span>
          </button>
        </div>
      </QuizCasca>
    );
  }

  if (caminho === "sei") {
    return (
      <QuizCasca passo={3} total={total} onVoltar={voltar} titulo="Quanto você gasta numa leva?"
        sub="Tudo que vai: ingredientes, embalagem, gás. Pode ser aproximado."
        rodape={<BotaoOuro onClick={onContinuar} disabled={!(custo > 0)}>CONTINUAR</BotaoOuro>}>
        <CampoDinheiro rotulo="Gasto na leva" valor={gasto} onChange={(g) => { setGasto(g); conta(g, rende); }} autoFocus />
        <Contador rotulo={`Quantas saem`} valor={rende} min={1} onChange={(r) => { setRende(r); conta(gasto, r); }} />
        {custo > 0 && <ResultadoOuro rotulo="Cada uma te custa" valor={reais(custo)} />}
      </QuizCasca>
    );
  }

  const mudar = (i: number, m: Partial<IngredienteRascunho>) => {
    const novos = itens.map((it, j) => (j === i ? { ...it, ...m } : it));
    setItens(novos);
    conta(totalDaReceita(novos), rende);
  };
  const totalReceita = totalDaReceita(itens);
  return (
    <QuizCasca passo={3} total={total} onVoltar={voltar} titulo={`O que vai em ${nome}?`}
      sub="Já marcamos o comum. Ajusta o que você compra e quanto pagou."
      rodape={<BotaoOuro onClick={onContinuar} disabled={!(custo > 0)}>CONTINUAR</BotaoOuro>}>
      <div className="flex flex-col gap-[7px]">
        {itens.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-[14px] px-3 py-2" style={{ background: it.usa ? "#121211" : "#0b0b0c", border: `1px solid ${it.usa ? "#26241f" : "#1a1917"}` }}>
            <button type="button" aria-label={it.usa ? "Tirar" : "Usar"} onClick={() => mudar(i, { usa: !it.usa })}
              className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
              style={it.usa ? { background: "#F5B800", color: "#1A1200" } : { border: "1.5px solid #3a3833" }}>
              {it.usa && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
            </button>
            <input value={it.nome} onChange={(e) => mudar(i, { nome: e.target.value })} className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-extrabold" aria-label="Ingrediente" />
            <MiniDinheiro valor={it.preco} onChange={(p) => mudar(i, { preco: p, usa: true })} />
          </div>
        ))}
        <button type="button" onClick={() => setItens([...itens, { nome: "", preco: 0, usa: true }])} className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1" style={{ color: "#F5B800" }}>
          <Plus className="w-3.5 h-3.5" /> adicionar ingrediente
        </button>
      </div>
      <Contador rotulo="Com isso saem quantas?" valor={rende} min={1} onChange={(r) => { setRende(r); conta(totalReceita, r); }} />
      {custo > 0 && <ResultadoOuro rotulo="Cada uma te custa" valor={reais(custo)} detalhe={`${reais(totalReceita)} ÷ ${rende}`} />}
    </QuizCasca>
  );
}

function MiniDinheiro({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [t, setT] = useState(valor > 0 ? valor.toFixed(2).replace(".", ",") : "");
  return (
    <input type="text" inputMode="numeric" placeholder="R$ 0,00" value={t} aria-label="Quanto pagou"
      onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 7); const n = d ? parseInt(d, 10) / 100 : 0; setT(d ? n.toFixed(2).replace(".", ",") : ""); onChange(n); }}
      className="w-[84px] h-9 rounded-[10px] text-right px-2 bg-[#151514] outline-none text-sm font-black tabular-nums" />
  );
}
