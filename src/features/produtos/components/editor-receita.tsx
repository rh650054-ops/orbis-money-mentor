/* A receita de quem faz (quiz e ficha): o que vai numa leva, quanto de cada um,
   o preço de 1 (opcional) e quanto a leva rende. A VANT faz a conta do custo. */
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { reaisDeTexto, textoDeReais } from "@/shared/lib/dinheiro";
import { custoPorUnidade } from "../lib/conta";
import { totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import { Contador, reais, useTextoDinheiro } from "./campos";
import { ResultadoOuro } from "./quiz-casca";

export function EditorReceita({ itens, rende, onItens, onRende, estoques }: {
  itens: IngredienteRascunho[]; rende: number;
  onItens: (i: IngredienteRascunho[]) => void; onRende: (n: number) => void;
  /** estoque de cada ingrediente pelo nome (minúsculo), quando já existe */
  estoques?: Map<string, number>;
}) {
  const mudar = (i: number, m: Partial<IngredienteRascunho>) => onItens(itens.map((it, j) => (j === i ? { ...it, ...m } : it)));
  const total = totalDaReceita(itens);
  const custo = custoPorUnidade(total, rende);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex text-[10.5px] font-black tracking-[.12em] px-1 gap-2" style={{ color: "#7b766e" }}>
        <span className="flex-1">NUMA LEVA VAI</span><span className="w-[58px] text-center">QTD</span><span className="w-[84px] text-right">PREÇO DE 1</span>
      </div>
      {itens.map((it, i) => {
        const tem = estoques?.get(it.nome.trim().toLowerCase());
        return (
          <div key={i} className="flex flex-col gap-0.5 rounded-[14px] px-3 py-2" style={{ background: it.usa ? "#121211" : "#0b0b0c", border: `1px solid ${it.usa ? "#26241f" : "#1a1917"}` }}>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={it.usa ? "Tirar" : "Usar"} onClick={() => mudar(i, { usa: !it.usa })}
                className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                style={it.usa ? { background: "#F5B800", color: "#1A1200" } : { border: "1.5px solid #3a3833" }}>
                {it.usa && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
              </button>
              <input value={it.nome} placeholder="Ingrediente" onChange={(e) => mudar(i, { nome: e.target.value })}
                className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-extrabold" aria-label="Ingrediente" />
              <MiniQtd valor={it.qtd} onChange={(qtd) => mudar(i, { qtd, usa: qtd > 0 })} />
              <MiniDinheiro valor={it.preco} onChange={(preco) => mudar(i, { preco })} />
            </div>
            {tem !== undefined && <span className="text-[10.5px] font-bold pl-[30px]" style={{ color: "#7b766e" }}>tem {fmt(tem)} no estoque</span>}
          </div>
        );
      })}
      <button type="button" onClick={() => onItens([...itens, { nome: "", qtd: 1, preco: 0, usa: true }])}
        className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: "#F5B800" }}>
        <Plus className="w-3.5 h-3.5" /> adicionar ingrediente
      </button>
      <Contador rotulo="Uma leva rende quantas unidades?" valor={rende} min={1} onChange={onRende} />
      {custo > 0
        ? <ResultadoOuro rotulo="Cada uma te custa" valor={reais(custo)} detalhe={`leva de ${reais(total)} ÷ ${rende}`} />
        : <p className="text-[11.5px] font-bold px-1" style={{ color: "#7b766e" }}>Sem preço? Tudo bem: o custo aparece quando você anotar a compra no "Tô no mercado".</p>}
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

/** Quantidade que aceita meio ("0,5" lata). */
function MiniQtd({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [t, setT] = useState(valor > 0 ? fmt(valor) : "");
  return (
    <input type="text" inputMode="decimal" placeholder="1" value={t} aria-label="Quantidade na leva"
      onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 7); setT(v); onChange(reaisDeTexto(v)); }}
      className="w-[58px] h-9 rounded-[10px] text-center bg-[#151514] outline-none text-sm font-black tabular-nums" />
  );
}

function MiniDinheiro({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const campo = useTextoDinheiro(valor, onChange);
  return (
    <span className="w-[84px] h-9 rounded-[10px] bg-[#151514] flex items-center px-2 gap-1">
      <span className="text-[11px] font-bold" style={{ color: "#7b766e" }}>R$</span>
      <input type="text" inputMode="decimal" placeholder={textoDeReais(0) || "0"} aria-label="Preço de 1" {...campo}
        className="w-full bg-transparent text-right outline-none text-sm font-black tabular-nums" />
    </span>
  );
}
