/* 25/11 (Rick, item 1C): costs WITHOUT physical stock — labour, fees, gas. They add to the recipe's
   cost (per unit × the yield, or once per recipe) and never leave any stock: production does not
   touch them. */
import { Plus, X } from "lucide-react";
import type { CustoExtra, PorConsumo } from "../lib/receitas";
import { reais } from "./campos";
import { MiniDinheiro } from "./mini-campos";

const SUGESTOES: [string, PorConsumo][] = [["Mão de obra", "unidade"], ["Gás", "receita"]];
const CHIP = (sel: boolean) => (sel ? { background: "#F5B800", color: "#1A1200" } : { background: "#1a1a19", color: "#d8d2c4", border: "1px solid #2c2a25" });

export function CustosSemEstoque({ extras, rende, onMudar }: { extras: CustoExtra[]; rende: number; onMudar: (e: CustoExtra[]) => void }) {
  const mudar = (i: number, m: Partial<CustoExtra>) => onMudar(extras.map((e, j) => (j === i ? { ...e, ...m } : e)));
  const faltam = SUGESTOES.filter(([n]) => !extras.some((e) => e.nome.trim().toLowerCase() === n.toLowerCase()));
  return (
    <div className="flex flex-col gap-2">
      {extras.map((e, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5" style={{ background: "#151515", border: "1px solid #26241f" }}>
          <div className="flex items-center gap-2">
            <input value={e.nome} placeholder="Ex.: mão de obra" aria-label="Nome do custo" onChange={(ev) => mudar(i, { nome: ev.target.value })}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-extrabold" />
            <button type="button" aria-label={`Tirar ${e.nome || "custo"}`} onClick={() => onMudar(extras.filter((_, j) => j !== i))} className="p-1" style={{ color: "#7b766e" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
            <MiniDinheiro valor={e.valor} rotulo={`Valor de ${e.nome || "custo"}`} onChange={(valor) => mudar(i, { valor })} />
            <button type="button" aria-pressed={e.por === "unidade"} onClick={() => mudar(i, { por: "unidade" })} className="rounded-full px-3 py-1.5 font-extrabold min-h-[34px]" style={CHIP(e.por === "unidade")}>em cada unidade</button>
            <button type="button" aria-pressed={e.por === "receita"} onClick={() => mudar(i, { por: "receita" })} className="rounded-full px-3 py-1.5 font-extrabold min-h-[34px]" style={CHIP(e.por === "receita")}>por receita</button>
          </div>
          {e.valor > 0 && e.por === "unidade" && rende >= 1 && (
            <span className="text-[12px] font-black" style={{ color: "#F5B800" }}>= {reais(e.valor * rende)} na receita (× {rende.toLocaleString("pt-BR")}) · não sai do estoque</span>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {faltam.map(([nome, por]) => (
          <button key={nome} type="button" onClick={() => onMudar([...extras, { nome, valor: 0, por }])}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)", color: "#F5B800" }}>
            <Plus className="w-3 h-3" /> {nome}
          </button>
        ))}
        <button type="button" onClick={() => onMudar([...extras, { nome: "", valor: 0, por: "unidade" }])}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={{ color: "#F5B800" }}>
          <Plus className="w-3 h-3" /> outro custo
        </button>
      </div>
    </div>
  );
}
