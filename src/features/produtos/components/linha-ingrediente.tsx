/* One ingredient of a recipe (quiz, product sheet and flavours). Approved design kept: dark card,
   yellow check, compact fields. 22/11 (Etapa 2) logic: what he BUYS ("Compro 1 kg por R$ 35,99"),
   what he USES in one batch ("Uso 200 g na leva") and the price are separate; the yield belongs to
   the recipe. "dá pra" is only a shortcut that fills "Uso" once. */
import { useState } from "react";
import { Check } from "lucide-react";
import type { IngredienteGuardado } from "../api/use-ingredientes-guardados-query";
import { compraNaTela, ingredienteIgual, nomeNormalizado, pacoteDaCompra, precoDe1, qtdPorDaPra, type IngredienteRascunho } from "../lib/receitas";
import type { Unidade } from "../types";
import { reais } from "./campos";
import { fmt } from "../lib/formato";
import { MiniDinheiro, MiniNumero } from "./mini-campos";

/** purchase unit on screen → batch unit + factor */
const COMPRA: { rotulo: string; leva: Unidade; fator: number }[] = [
  { rotulo: "un", leva: "un", fator: 1 }, { rotulo: "kg", leva: "g", fator: 1000 }, { rotulo: "g", leva: "g", fator: 1 },
  { rotulo: "l", leva: "ml", fator: 1000 }, { rotulo: "ml", leva: "ml", fator: 1 },
];
const CINZA = "#8A8A8A";
const LINHA = "flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]";

/** Saved ingredients matching what he types (the purchase lands on the same ingredient). */
function Sugestoes({ texto, lista, onEscolher }: { texto: string; lista: IngredienteGuardado[]; onEscolher: (g: IngredienteGuardado) => void }) {
  const t = nomeNormalizado(texto);
  const achados = lista.filter((g) => nomeNormalizado(g.nome) !== t && (!t || nomeNormalizado(g.nome).includes(t))).slice(0, 6);
  if (achados.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pl-[30px]">
      <span className="w-full text-[10.5px] font-black tracking-[.12em]" style={{ color: CINZA }}>JÁ GUARDADOS</span>
      {achados.map((g) => (
        <button key={g.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onEscolher(g)}
          className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)", color: "#F5B800" }}>
          {g.nome}
        </button>
      ))}
    </div>
  );
}

export function LinhaIngrediente({ it, rende, nomeProduto = "unidades", estoque, sugestoes, repetido, avisoRepetido = "esse ingrediente já está na receita", onMudar }: {
  it: IngredienteRascunho; rende: number; nomeProduto?: string; estoque?: number; sugestoes: IngredienteGuardado[];
  /** another line of the same recipe is this same ingredient */
  repetido?: boolean;
  /** why it is flagged (default: repeated in this recipe) */
  avisoRepetido?: string;
  onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [daPra, setDaPra] = useState(0);
  const compra = compraNaTela(it.unidade, it.pacote);
  const custoLeva = it.qtd > 0 ? it.qtd * precoDe1(it) : 0;
  const usar = (g: IngredienteGuardado) => {
    // same ingredient, one row in the database: shared by every recipe and by the market purchases
    onMudar({ id: g.id, nome: g.nome, unidade: g.unidade, pacote: g.pacote, ...(g.precoPacote > 0 && !(it.precoPacote > 0) ? { precoPacote: g.precoPacote } : {}) });
    setEditando(false);
  };
  const aoSair = () => {
    setEditando(false);
    const igual = it.id ? undefined : ingredienteIgual(it.nome, sugestoes);
    if (igual) usar(igual);   // "leite  Condensado" → the "Leite condensado" he already has
  };
  return (
    <div className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5" style={{ background: it.usa ? "#151515" : "#0b0b0c", border: `1px solid ${repetido ? "#FF6B6B" : it.usa ? "#26241f" : "#1a1917"}` }}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={it.usa ? "Tirar" : "Usar"} onClick={() => onMudar({ usa: !it.usa })}
          className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
          style={it.usa ? { background: "#F5B800", color: "#1A1200" } : { border: "1.5px solid #3a3833" }}>
          {it.usa && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
        </button>
        <input value={it.nome} placeholder="Nome do ingrediente" onChange={(e) => onMudar({ nome: e.target.value, id: undefined })}
          onFocus={() => setEditando(true)} onBlur={aoSair} enterKeyHint="next"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-extrabold" aria-label="Ingrediente" />
      </div>
      {editando && <Sugestoes texto={it.nome} lista={sugestoes} onEscolher={usar} />}
      {repetido && <span className="text-[11px] font-black pl-[30px]" style={{ color: "#FF6B6B" }}>{avisoRepetido}</span>}
      {it.usa && (
        <>
          <div className={LINHA} style={{ color: "#b9b3a6" }}>
            <span>Compro</span>
            <MiniNumero key={`q-${compra.unidade}`} valor={compra.valor} rotulo="Quanto compra"
              onChange={(v) => onMudar({ pacote: v > 0 ? pacoteDaCompra(v, compra.unidade, it.unidade) : 1 })} />
            <select value={compra.unidade} aria-label="Unidade da compra"
              onChange={(e) => { const c = COMPRA.find((x) => x.rotulo === e.target.value) ?? COMPRA[0]!; onMudar({ unidade: c.leva, pacote: Math.max(1, compra.valor) * c.fator }); }}
              className="h-9 rounded-[10px] bg-[#1a1a19] px-2 outline-none text-sm font-black text-[#F4F1EA]">
              {COMPRA.map((u) => <option key={u.rotulo} value={u.rotulo}>{u.rotulo}</option>)}
            </select>
            <span>por</span>
            <MiniDinheiro valor={it.precoPacote} onChange={(precoPacote) => onMudar({ precoPacote })} />
          </div>
          <div className={LINHA} style={{ color: "#b9b3a6" }}>
            {it.aprender ? (
              <span className="h-9 rounded-[10px] px-2.5 inline-flex items-center text-[12px] font-black" style={{ background: "#1a1305", color: "#F5B800" }}>? descubro na compra</span>
            ) : (
              <>
                <span>Uso</span>
                <MiniNumero valor={it.qtd} exemplo="?" rotulo="Quanto usa na leva" onChange={(qtd) => onMudar({ qtd })} />
                <span>{it.unidade} na leva</span>
                {custoLeva > 0 && <span className="font-black" style={{ color: "#F5B800" }}>→ {reais(custoLeva)}</span>}
              </>
            )}
          </div>
          {/* the shortcut shows while "Uso" is empty (or while he is using it) */}
          {!it.aprender && rende > 0 && (!(it.qtd > 0) || daPra > 0) && (
            <div className={LINHA} style={{ color: CINZA }}>
              <span>ou: essa compra dá pra</span>
              <MiniNumero valor={daPra} largura={56} exemplo="?" rotulo={`Dá pra quantas ${nomeProduto}`} onChange={(n) => {
                setDaPra(n);
                if (n > 0) onMudar({ qtd: qtdPorDaPra({ pacote: it.pacote, daPra: n }, rende) });  // fills "Uso" only; the yield stays his
              }} />
              <span>{nomeProduto}</span>
            </div>
          )}
          <button type="button" onClick={() => onMudar({ aprender: !it.aprender, ...(it.aprender ? {} : { qtd: 0 }) })} aria-pressed={!!it.aprender}
            className="self-start text-[11px] font-extrabold pl-[30px] py-0.5 underline underline-offset-2" style={{ color: it.aprender ? "#F5B800" : CINZA }}>
            {it.aprender ? "sei quanto uso, vou digitar" : "não sei quanto uso · descubro na compra"}
          </button>
          <span className="text-[10.5px] font-bold pl-[30px]" style={{ color: !it.aprender && !(it.qtd > 0) ? "#F5B800" : CINZA }}>
            {!it.aprender && !(it.qtd > 0) ? "rascunho: falta quanto usa · " : ""}
            {estoque !== undefined ? `tem ${fmt(estoque)} ${it.unidade} guardado · ` : ""}pode ser aproximado
          </span>
        </>
      )}
    </div>
  );
}
