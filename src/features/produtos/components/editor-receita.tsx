/* A receita de quem faz (quiz e ficha): o que vai numa leva e quanto de cada um,
   como ele compra cada coisa ("pacote de 100 por R$ 8", "lata de 800 g por R$ 30",
   pode ser aproximado) e quanto a leva rende. A VANT faz a conta do custo. */
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { reaisDeTexto } from "@/shared/lib/dinheiro";
import { useIngredientesGuardadosQuery, type IngredienteGuardado } from "../api/use-ingredientes-guardados-query";
import { custoPorUnidade } from "../lib/conta";
import { novoIngrediente, precoDe1, totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import { UNIDADES, type Unidade } from "../types";
import { Contador, reais, useTextoDinheiro } from "./campos";
import { ResultadoOuro } from "./quiz-casca";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

export function EditorReceita({ itens, rende, onItens, onRende, estoques }: {
  itens: IngredienteRascunho[]; rende: number;
  onItens: (i: IngredienteRascunho[]) => void; onRende: (n: number) => void;
  /** estoque de cada ingrediente pelo nome (minúsculo), quando já existe */
  estoques?: Map<string, number>;
}) {
  const mudar = (i: number, m: Partial<IngredienteRascunho>) => onItens(itens.map((it, j) => (j === i ? { ...it, ...m } : it)));
  const guardados = useIngredientesGuardadosQuery().data ?? [];
  const total = totalDaReceita(itens);
  const custo = custoPorUnidade(total, rende);
  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((it, i) => (
        <LinhaIngrediente key={i} it={it} estoque={estoques?.get(it.nome.trim().toLowerCase())} onMudar={(m) => mudar(i, m)}
          sugestoes={guardados.filter((g) => !itens.some((x, j) => j !== i && x.nome.trim().toLowerCase() === g.nome.trim().toLowerCase()))} />
      ))}
      <button type="button" onClick={() => onItens([...itens, novoIngrediente()])}
        className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: "#F5B800" }}>
        <Plus className="w-3.5 h-3.5" /> adicionar ingrediente
      </button>
      <Contador rotulo="Uma leva rende quantas unidades?" valor={rende} min={1} onChange={onRende} />
      {custo > 0
        ? <ResultadoOuro rotulo="Cada uma te custa" valor={reais(custo)}
            detalhe={`leva de ${reais(total)} ÷ ${rende}${itens.some((i) => i.usa && i.aprender && i.nome.trim()) ? ` · + ${itens.filter((i) => i.usa && i.aprender && i.nome.trim()).map((i) => i.nome.trim()).join(", ")} entra depois da compra` : ""}`} />
        : <p className="text-[11.5px] font-bold px-1" style={{ color: "#7b766e" }}>Sem preço? Tudo bem: o custo aparece quando você anotar a compra no "Tô no mercado".</p>}
    </div>
  );
}

/** Ingredientes já guardados que combinam com o que ele está digitando. */
function Sugestoes({ texto, lista, onEscolher }: { texto: string; lista: IngredienteGuardado[]; onEscolher: (g: IngredienteGuardado) => void }) {
  const t = texto.trim().toLowerCase();
  const achados = lista.filter((g) => g.nome.trim().toLowerCase() !== t && (!t || g.nome.toLowerCase().includes(t))).slice(0, 6);
  if (achados.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pl-[30px]">
      <span className="w-full text-[10.5px] font-black tracking-[.12em]" style={{ color: "#7b766e" }}>JÁ GUARDADOS</span>
      {achados.map((g) => (
        <button key={g.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onEscolher(g)}
          className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)", color: "#F5B800" }}>
          {g.nome}
        </button>
      ))}
    </div>
  );
}

export function LinhaIngrediente({ it, estoque, sugestoes, onMudar }: {
  it: IngredienteRascunho; estoque?: number; sugestoes: IngredienteGuardado[]; onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const p1 = precoDe1(it);
  return (
    <div className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5" style={{ background: it.usa ? "#121211" : "#0b0b0c", border: `1px solid ${it.usa ? "#26241f" : "#1a1917"}` }}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={it.usa ? "Tirar" : "Usar"} onClick={() => onMudar({ usa: !it.usa })}
          className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
          style={it.usa ? { background: "#F5B800", color: "#1A1200" } : { border: "1.5px solid #3a3833" }}>
          {it.usa && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
        </button>
        <input value={it.nome} placeholder="Nome do ingrediente" onChange={(e) => onMudar({ nome: e.target.value })}
          onFocus={() => setEditando(true)} onBlur={() => setEditando(false)}
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-extrabold" aria-label="Ingrediente" />
      </div>
      {editando && (
        <Sugestoes texto={it.nome} lista={sugestoes} onEscolher={(g) => {
          // mesmo nome = mesmo ingrediente: a compra do mercado cai certinho nesta receita
          onMudar({ id: g.id, nome: g.nome, unidade: g.unidade, pacote: g.pacote, ...(g.precoPacote > 0 && !(it.precoPacote > 0) ? { precoPacote: g.precoPacote } : {}) });
          setEditando(false);
        }} />
      )}
      {it.usa && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]" style={{ color: "#b9b3a6" }}>
            <span>Numa leva vai</span>
            {it.aprender
              ? <span className="h-9 rounded-[10px] px-2.5 inline-flex items-center text-[12px] font-black" style={{ background: "#1a1305", color: "#F5B800" }}>? descubro na compra</span>
              : <MiniNumero valor={it.qtd} onChange={(qtd) => onMudar({ qtd })} rotulo="Quantidade na leva" />}
            <SeletorUnidade valor={it.unidade} onChange={(unidade) => onMudar({ unidade })} />
          </div>
          {/* 26/10 (Rick): fruta/polpa sem medida certa — a 1ª compra ensina ("5 kg pra 100 = 50 g cada") */}
          <button type="button" onClick={() => onMudar({ aprender: !it.aprender })} aria-pressed={!!it.aprender}
            className="self-start text-[11px] font-extrabold pl-[30px] py-0.5 underline underline-offset-2" style={{ color: it.aprender ? "#F5B800" : "#7b766e" }}>
            {it.aprender ? "sei a quantidade, vou digitar" : "não sei quanto vai · descubro na compra"}
          </button>
          <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]" style={{ color: "#b9b3a6" }}>
            <span>Você compra</span>
            <MiniNumero valor={it.pacote} onChange={(pacote) => onMudar({ pacote: pacote > 0 ? pacote : 1 })} rotulo="Quanto vem na compra" />
            <span>{it.unidade} por</span>
            <MiniDinheiro valor={it.precoPacote} onChange={(precoPacote) => onMudar({ precoPacote })} />
          </div>
          <span className="text-[10.5px] font-bold pl-[30px]" style={{ color: "#7b766e" }}>
            {p1 > 0 && it.pacote > 1 ? `≈ ${reais(p1)} cada ${it.unidade} · ` : ""}
            {estoque !== undefined ? `tem ${fmt(estoque)} ${it.unidade} guardado · ` : ""}pode ser aproximado
          </span>
        </>
      )}
    </div>
  );
}

/** Número que aceita apagar tudo e meio ("0,5"). */
function MiniNumero({ valor, onChange, rotulo }: { valor: number; onChange: (n: number) => void; rotulo: string }) {
  const [t, setT] = useState(valor > 0 ? fmt(valor) : "");
  return (
    <input type="text" inputMode="decimal" placeholder="1" value={t} aria-label={rotulo}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 8); setT(v); onChange(reaisDeTexto(v)); }}
      className="w-[64px] h-9 rounded-[10px] text-center bg-[#1a1a19] outline-none text-sm font-black tabular-nums text-[#F4F1EA]" />
  );
}

function SeletorUnidade({ valor, onChange }: { valor: Unidade; onChange: (u: Unidade) => void }) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value as Unidade)} aria-label="Unidade"
      className="h-9 rounded-[10px] bg-[#1a1a19] px-2 outline-none text-sm font-black text-[#F4F1EA]">
      {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

function MiniDinheiro({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const campo = useTextoDinheiro(valor, onChange);
  return (
    <span className="w-[92px] h-9 rounded-[10px] bg-[#1a1a19] flex items-center px-2 gap-1">
      <span className="text-[11px] font-bold" style={{ color: "#7b766e" }}>R$</span>
      <input type="text" inputMode="decimal" placeholder="0" aria-label="Quanto paga nessa compra" {...campo}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-transparent text-right outline-none text-sm font-black tabular-nums text-[#F4F1EA]" />
    </span>
  );
}
