/* SABORES na ficha (Rick, 26/10/2026): a base vai em todos; aqui só o que muda em cada
   sabor. Chips pra trocar de sabor, "+ sabor", e embaixo o custo de cada unidade por sabor. */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useIngredientesGuardadosQuery } from "../api/use-ingredientes-guardados-query";
import { ehRascunho, linhasRepetidas, novoIngrediente, type IngredienteRascunho } from "../lib/receitas";
import { custoDoSabor, emojiDoSabor, novoSabor, type SaborRascunho } from "../lib/sabores";
import { reais } from "./campos";
import { LinhaIngrediente } from "./linha-ingrediente";

const OURO = "#F5B800";

export function EditorSabores({ sabores, base, rende, preco, estoques, onMudar, nomeProduto = "unidades" }: {
  sabores: SaborRascunho[]; base: IngredienteRascunho[]; rende: number; preco: number;
  estoques?: Map<string, number>; onMudar: (s: SaborRascunho[]) => void; nomeProduto?: string;
}) {
  const [ativo, setAtivo] = useState(0);
  const guardados = useIngredientesGuardadosQuery().data ?? [];
  const s = sabores[ativo];
  const mudarSabor = (i: number, m: Partial<SaborRascunho>) => onMudar(sabores.map((x, j) => (j === i ? { ...x, ...m } : x)));
  const adicionar = () => { onMudar([...sabores, novoSabor()]); setAtivo(sabores.length); };
  const tirar = (i: number) => { onMudar(sabores.filter((_, j) => j !== i)); setAtivo(Math.max(0, Math.min(ativo, sabores.length - 2))); };
  const temBase = base.some((i) => i.usa && i.nome.trim());
  const comCusto = sabores.filter((x) => x.nome.trim()).map((x) => ({ ...x, custo: custoDoSabor(base, x, rende) }));

  return (
    <div className="flex flex-col gap-2.5">
      {/* 22/11: with no base, each flavour carries its whole recipe (different recipes per flavour) */}
      <p className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>
        {temBase
          ? <>A receita acima vai em <b className="text-[#F4F1EA]">todos</b> os sabores. Aqui, só o que muda em cada um.</>
          : <>Sem receita base: <b className="text-[#F4F1EA]">cada sabor tem a sua receita</b>, com tudo que vai nele.</>}
      </p>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-0.5">
        {sabores.map((x, i) => (
          <button key={i} type="button" onClick={() => setAtivo(i)} aria-pressed={i === ativo}
            className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-extrabold"
            style={i === ativo ? { background: "#1a1305", border: `1px solid ${OURO}`, color: OURO } : { background: "#121211", border: "1px solid #26241f" }}>
            {x.emoji || emojiDoSabor(x.nome)} {x.nome.trim() || "Novo sabor"}
          </button>
        ))}
        <button type="button" onClick={adicionar} className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-extrabold inline-flex items-center gap-1"
          style={{ border: "1px dashed #3a3833", color: OURO }}>
          <Plus className="w-3.5 h-3.5" /> sabor
        </button>
      </div>

      {s && (
        <div className="flex flex-col gap-2 rounded-[16px] px-3 py-3" style={{ background: "#0e0e10", border: "1px solid #26241f" }}>
          <div className="flex items-center gap-2">
            <input value={s.emoji} onChange={(e) => mudarSabor(ativo, { emoji: e.target.value.slice(0, 4) })} aria-label="Emoji do sabor"
              className="w-11 h-10 rounded-[10px] bg-[#1a1a19] text-center outline-none text-[18px]" />
            <input value={s.nome} placeholder="Nome do sabor (ex.: Morango)" aria-label="Nome do sabor"
              onChange={(e) => mudarSabor(ativo, { nome: e.target.value, emoji: s.emoji && s.emoji !== emojiDoSabor(s.nome) ? s.emoji : emojiDoSabor(e.target.value) })}
              className="flex-1 min-w-0 h-10 rounded-[10px] bg-[#1a1a19] px-3 outline-none text-[14px] font-extrabold" />
            <button type="button" onClick={() => tirar(ativo)} aria-label="Tirar sabor" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#7b766e" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11.5px] font-bold" style={{ color: "#8A8A8A" }}>{temBase ? "O que entra só no" : "Tudo que vai no"} {s.nome.trim() || "sabor"}{s.itens.some(ehRascunho) ? " · tem ingrediente sem quantidade (rascunho)" : ""}:</p>
          {s.itens.map((it, i) => (
            <LinhaIngrediente key={i} it={it} rende={rende} nomeProduto={nomeProduto} estoque={estoques?.get(it.nome.trim().toLowerCase())}
              repetido={linhasRepetidas([...base, ...s.itens]).has(base.length + i)}
              onMudar={(m) => mudarSabor(ativo, { itens: s.itens.map((x, j) => (j === i ? { ...x, ...m } : x)) })}
              sugestoes={guardados.filter((g) => !s.itens.some((x, j) => j !== i && x.id === g.id))} />
          ))}
          <button type="button" onClick={() => mudarSabor(ativo, { itens: [...s.itens, novoIngrediente("", 0)] })}
            className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: OURO }}>
            <Plus className="w-3.5 h-3.5" /> ingrediente do {s.nome.trim() || "sabor"}
          </button>
        </div>
      )}

      {comCusto.length > 0 && (
        <div className="rounded-[16px] px-4 py-3" style={{ border: `1px solid ${OURO}55`, background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)" }}>
          <p className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>CUSTO DE CADA UNIDADE</p>
          {comCusto.map((x, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-[14px] font-black">{x.emoji} {x.nome}</p>
                {x.custo != null && preco > 0 && <p className="text-[11.5px]" style={{ color: preco - x.custo > 0 ? "#3DD68C" : "#FF7A6B" }}>sobra {reais(preco - x.custo)} por venda</p>}
              </div>
              <p className="text-[18px] font-black tabular-nums" style={{ color: x.custo != null ? OURO : "#7b766e" }}>{x.custo != null ? reais(x.custo) : "falta preço"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
