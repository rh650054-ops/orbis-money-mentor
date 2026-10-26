/* A receita de quem faz (quiz e ficha). Do jeito que o vendedor pensa (Rick, 26/10/2026):
   "compro 1 kg de leite em pó por R$ 35,99 e dá pra 100 garrafinhas". De cada ingrediente
   ele diz o que compra, quanto paga e pra quantas dá. A VANT converte isso em quantidade
   por leva (a leva = o maior "dá pra") e faz o custo de cada unidade.
   "Não sei pra quantas dá" → a 1ª compra ensina (aprender). */
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { reaisDeTexto } from "@/shared/lib/dinheiro";
import { useIngredientesGuardadosQuery, type IngredienteGuardado } from "../api/use-ingredientes-guardados-query";
import { custoPorUnidade } from "../lib/conta";
import { compraNaTela, custoPorDaPra, novoIngrediente, pacoteDaCompra, qtdPorDaPra, rendePelosDaPra, totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import type { Unidade } from "../types";
import { reais, useTextoDinheiro } from "./campos";
import { ResultadoOuro } from "./quiz-casca";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
/** unidade da compra na tela → unidade da leva + fator */
const COMPRA: { rotulo: string; leva: Unidade; fator: number }[] = [
  { rotulo: "un", leva: "un", fator: 1 }, { rotulo: "kg", leva: "g", fator: 1000 }, { rotulo: "g", leva: "g", fator: 1 },
  { rotulo: "l", leva: "ml", fator: 1000 }, { rotulo: "ml", leva: "ml", fator: 1 },
];

export function EditorReceita({ itens, rende, onItens, onRende, estoques, nomeProduto = "unidades" }: {
  itens: IngredienteRascunho[]; rende: number;
  onItens: (i: IngredienteRascunho[]) => void; onRende: (n: number) => void;
  /** estoque de cada ingrediente pelo nome (minúsculo), quando já existe */
  estoques?: Map<string, number>;
  nomeProduto?: string;
}) {
  const guardados = useIngredientesGuardadosQuery().data ?? [];
  // a leva segue o maior "dá pra": quem compra pra 100 define a leva de 100
  const rendeAuto = rendePelosDaPra(itens, rende);
  useEffect(() => {
    if (rendeAuto !== rende) onRende(rendeAuto);
    // quem tem "dá pra" ganha a quantidade por leva sozinho (inclusive ao voltar do banco)
    const ajustados = itens.map((it) => (it.daPra ? { ...it, qtd: qtdPorDaPra(it, rendeAuto) } : it));
    if (ajustados.some((a, i) => a.qtd !== itens[i]?.qtd)) onItens(ajustados);
  }, [rendeAuto, rende, itens, onRende, onItens]);
  const mudar = (i: number, m: Partial<IngredienteRascunho>) => onItens(itens.map((it, j) => {
    if (j !== i) return it.daPra ? { ...it, qtd: qtdPorDaPra(it, rendeAuto) } : it;
    const n = { ...it, ...m };
    return n.daPra ? { ...n, qtd: qtdPorDaPra(n, rendePelosDaPra(itens.map((x, k) => (k === i ? n : x)), rende)) } : n;
  }));
  const total = totalDaReceita(itens);
  const custo = custoPorUnidade(total, rende);
  const aprendendo = itens.filter((i) => i.usa && i.aprender && i.nome.trim()).map((i) => i.nome.trim());
  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((it, i) => (
        <LinhaIngrediente key={i} it={it} rende={rendeAuto} nomeProduto={nomeProduto} estoque={estoques?.get(it.nome.trim().toLowerCase())} onMudar={(m) => mudar(i, m)}
          sugestoes={guardados.filter((g) => !itens.some((x, j) => j !== i && x.nome.trim().toLowerCase() === g.nome.trim().toLowerCase()))} />
      ))}
      <button type="button" onClick={() => onItens([...itens, novoIngrediente()])}
        className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: "#F5B800" }}>
        <Plus className="w-3.5 h-3.5" /> adicionar ingrediente
      </button>
      {custo > 0
        ? <ResultadoOuro rotulo={`Cada ${nomeProduto === "unidades" ? "uma" : nomeProduto} te custa`} valor={reais(custo)}
            detalhe={`${rende} ${nomeProduto} por ${reais(total)}${aprendendo.length ? ` · + ${aprendendo.join(", ")} entra depois da compra` : ""}`} />
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

export function LinhaIngrediente({ it, rende, nomeProduto = "unidades", estoque, sugestoes, onMudar }: {
  it: IngredienteRascunho; rende: number; nomeProduto?: string; estoque?: number; sugestoes: IngredienteGuardado[];
  onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const compra = compraNaTela(it.unidade, it.pacote);
  const cada = custoPorDaPra(it);
  const semDaPra = !it.aprender && !(it.daPra && it.daPra > 0);
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
            <span>Compro</span>
            <MiniNumero key={`q-${compra.unidade}`} valor={compra.valor} rotulo="Quanto compra"
              onChange={(v) => onMudar({ pacote: v > 0 ? pacoteDaCompra(v, compra.unidade, it.unidade) : 1 })} />
            <select value={compra.unidade} aria-label="Unidade da compra"
              onChange={(e) => {
                const c = COMPRA.find((x) => x.rotulo === e.target.value) ?? COMPRA[0]!;
                onMudar({ unidade: c.leva, pacote: Math.max(1, compra.valor) * c.fator });
              }}
              className="h-9 rounded-[10px] bg-[#1a1a19] px-2 outline-none text-sm font-black text-[#F4F1EA]">
              {COMPRA.map((u) => <option key={u.rotulo} value={u.rotulo}>{u.rotulo}</option>)}
            </select>
            <span>por</span>
            <MiniDinheiro valor={it.precoPacote} onChange={(precoPacote) => onMudar({ precoPacote })} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]" style={{ color: "#b9b3a6" }}>
            {it.aprender ? (
              <span className="h-9 rounded-[10px] px-2.5 inline-flex items-center text-[12px] font-black" style={{ background: "#1a1305", color: "#F5B800" }}>? descubro na compra</span>
            ) : (
              <>
                <span>e dá pra</span>
                <MiniNumero valor={it.daPra ?? 0} rotulo={`Dá pra quantas ${nomeProduto}`} onChange={(daPra) => onMudar({ daPra: daPra > 0 ? daPra : undefined })} />
                <span>{nomeProduto}</span>
              </>
            )}
            {cada > 0 && !it.aprender && <span className="font-black" style={{ color: "#F5B800" }}>→ {reais(cada)} cada</span>}
          </div>
          {/* fruta/polpa sem medida certa: a 1ª compra ensina ("5 kg pra 100 = 50 g cada") */}
          <button type="button" onClick={() => onMudar({ aprender: !it.aprender, ...(it.aprender ? {} : { daPra: undefined, qtd: 0 }) })} aria-pressed={!!it.aprender}
            className="self-start text-[11px] font-extrabold pl-[30px] py-0.5 underline underline-offset-2" style={{ color: it.aprender ? "#F5B800" : "#7b766e" }}>
            {it.aprender ? "sei pra quantas dá, vou digitar" : "não sei pra quantas dá · descubro na compra"}
          </button>
          <span className="text-[10.5px] font-bold pl-[30px]" style={{ color: semDaPra ? "#F5B800" : "#7b766e" }}>
            {semDaPra ? `falta dizer pra quantas ${nomeProduto} dá · ` : ""}
            {it.daPra && it.daPra > 0 && rende > 0 && !it.aprender ? `numa leva de ${rende} vai ${fmt(qtdPorDaPra(it, rende))} ${it.unidade} · ` : ""}
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

function MiniDinheiro({ valor, onChange, rotulo = "Quanto paga nessa compra" }: { valor: number; onChange: (n: number) => void; rotulo?: string }) {
  const campo = useTextoDinheiro(valor, onChange);
  return (
    <span className="w-[92px] h-9 rounded-[10px] bg-[#1a1a19] flex items-center px-2 gap-1">
      <span className="text-[11px] font-bold" style={{ color: "#7b766e" }}>R$</span>
      <input type="text" inputMode="decimal" placeholder="0" aria-label={rotulo} {...campo}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-transparent text-right outline-none text-sm font-black tabular-nums text-[#F4F1EA]" />
    </span>
  );
}
