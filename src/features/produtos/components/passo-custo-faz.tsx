/* Passo 3 (eu mesmo faço) — monta a receita (recomendado: ela é salva e alimenta o
   "Tô no mercado"), "sei mais ou menos" (leva ÷ rendimento) ou descobrir depois. */
import { useEffect, useState } from "react";
import { useReceitaPorUnidadeDisponivel } from "../api/use-receita-por-unidade";
import { custoPorUnidade } from "../lib/conta";
import { ingredientesSugeridos, receitaDoRascunho, resumoDoCusto, type CustoExtra, type IngredienteRascunho } from "../lib/receitas";
import type { ItemReceita } from "../types";
import { CampoDinheiro, Contador, reais } from "./campos";
import { EditorReceita } from "./editor-receita";

const plural = (n: string) => { const s = n.trim().toLowerCase(); return s ? (s.endsWith("s") ? s : `${s}s`) : "unidades"; };
import { BotaoOuro, QuizCasca, ResultadoOuro } from "./quiz-casca";

const CARD = { background: "#0f0f10", border: "1px solid #26241f" };
const OURO_BORDA = { border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" };

export function PassoCustoFaz({ nome, custo, total, receitaInicial, rendeInicial, extrasIniciais = [], onCusto, onRende, onReceita, onContinuar, onVoltar }: {
  nome: string; custo: number; total: number; receitaInicial: IngredienteRascunho[] | null; rendeInicial: number;
  onCusto: (n: number) => void; onRende: (n: number) => void;
  onReceita: (r: ItemReceita[] | null, rende: number, extras?: CustoExtra[]) => void; onContinuar: () => void; onVoltar: () => void;
  /** 25/11: costs without stock already typed in this registration */
  extrasIniciais?: CustoExtra[];
}) {
  const [caminho, setCaminho] = useState<null | "sei" | "receita">(receitaInicial ? "receita" : null);
  const [gasto, setGasto] = useState(0);
  // 22/11: the yield is HIS number: it starts empty instead of an assumed 20
  const [rende, setRende] = useState(rendeInicial > 0 ? rendeInicial : 0);
  const [itens, setItens] = useState<IngredienteRascunho[]>(() => receitaInicial ?? ingredientesSugeridos(nome));
  const [extras, setExtras] = useState<CustoExtra[]>(extrasIniciais);
  const porUnidade = useReceitaPorUnidadeDisponivel().data === true;
  // the suggestions were made before we knew the database has per-unit lines: redo them, untouched only
  const [sugeridos, setSugeridos] = useState(() => (receitaInicial ? null : itens));
  useEffect(() => {
    if (porUnidade && sugeridos && itens === sugeridos) { const n = ingredientesSugeridos(nome, 20, true); setItens(n); setSugeridos(null); }
  }, [porUnidade, sugeridos, itens, nome]);
  const voltar = () => (caminho ? setCaminho(null) : onVoltar());

  if (!caminho) {
    return (
      <QuizCasca passo={3} total={total} onVoltar={onVoltar} titulo={`Como você faz ${nome}?`}
        sub="Com a sua receita, a VANT calcula o custo e sabe quantas saem de cada compra do mercado." rodape={null}>
        <div className="flex flex-col gap-3 mt-3">
          {/* 24/11: the recipe path, highlighted as VANT Receita Inteligente (same editor behind it) */}
          <button type="button" onClick={() => setCaminho("receita")} className="rounded-[20px] px-4 py-5 text-left flex flex-col gap-1.5" style={OURO_BORDA}>
            <span className="text-[10.5px] font-black tracking-[.16em]" style={{ color: "#F5B800" }}>VANT RECEITA INTELIGENTE</span>
            <span className="text-[18px] font-black leading-tight">Vamos descobrir quanto custa produzir seu produto.</span>
            <span className="text-[12.5px]" style={{ color: "#b9b3a6" }}>Adicione os ingredientes que você utiliza. A VANT calcula os custos para você.</span>
            <span className="text-[13px] font-black mt-1" style={{ color: "#F5B800" }}>Montar minha receita ›</span>
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

  const aplicar = (n: IngredienteRascunho[], r: number, ext: CustoExtra[] = extras) => {
    // before the migration every line is per recipe (the old database would read per unit as per batch)
    const novos = porUnidade ? n : n.map((i) => ({ ...i, por: "receita" as const }));
    if (!porUnidade) ext = [];
    setItens(novos); setRende(r); setExtras(ext);
    // 25/11: batch lines + per-unit lines × yield + costs without stock, ÷ yield
    onCusto(r >= 1 ? Math.round(resumoDoCusto(novos, r, ext).porUnidade * 100) / 100 : 0);
    onRende(r);
    onReceita(receitaDoRascunho(novos), r, ext);
  };
  // an incomplete recipe may go on as a draft; the yield is what makes it a recipe
  const valida = receitaDoRascunho(itens).length > 0 && rende >= 1;
  return (
    <QuizCasca passo={3} total={total} onVoltar={voltar} titulo={`Receita de ${nome}`}
      sub={"Primeiro quanto rende, depois cada ingrediente. Não sabe uma quantidade? Marque \"Ainda não sei\" e complete depois."}
      rodape={<BotaoOuro onClick={() => { aplicar(itens, rende); onContinuar(); }} disabled={!valida}>CONTINUAR</BotaoOuro>}>
      <EditorReceita resumoFixo itens={itens} rende={rende} nomeProduto={plural(nome)} onItens={(n) => aplicar(n, rende)} onRende={(r) => aplicar(itens, r)}
        extras={extras} onExtras={(e) => aplicar(itens, rende, e)} />
    </QuizCasca>
  );
}
