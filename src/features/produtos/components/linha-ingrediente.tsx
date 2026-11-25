/* One ingredient of a recipe (quiz, product sheet and flavours). Approved design kept: dark card,
   yellow check, compact fields. 25/11 (Rick): only three questions are open — Quanto compro? Quanto
   pago? Quanto uso? — and the VANT does the rest. "Quanto uso?" offers Inteira / Metade / Quantidade /
   Não sei in one compact row (QuantoUsa); "dá pra" and by weight stay under "Mais opções". A line is used per recipe or in each
   unit produced, and can move between the two without being typed again. */
import { useRef, useState } from "react";
import { ArrowDownUp, Check } from "lucide-react";
import type { IngredienteGuardado } from "../api/use-ingredientes-guardados-query";
import { compraNaTela, ingredienteIgual, pacoteDaCompra, precoDe1, qtdNaLeva, type IngredienteRascunho, type PorConsumo } from "../lib/receitas";
import type { Unidade } from "../types";
import { reais } from "./campos";
import { fmt } from "../lib/formato";
import { MiniDinheiro, MiniNumero } from "./mini-campos";
import { LinhaConfirmar, LinhaMaisOpcoes } from "./linha-mais-opcoes";
import { QuantoUsa } from "./quanto-usa";
import { useMedidaDeUsoDisponivel } from "../api/use-medidas";
import { EMBALAGENS } from "../lib/medidas";
import { Sugestoes } from "./sugestoes-ingrediente";

/** purchase unit on screen → batch unit + factor */
const COMPRA: { rotulo: string; leva: Unidade; fator: number }[] = [
  { rotulo: "un", leva: "un", fator: 1 }, { rotulo: "kg", leva: "g", fator: 1000 }, { rotulo: "g", leva: "g", fator: 1 },
  { rotulo: "l", leva: "ml", fator: 1000 }, { rotulo: "ml", leva: "ml", fator: 1 },
];
const CINZA = "#8A8A8A";
const LINHA = "flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]";
const PERGUNTA = "w-[91px] min-[380px]:w-[96px] shrink-0 text-[11.5px] min-[380px]:text-[12px] font-extrabold whitespace-nowrap";

export function LinhaIngrediente({ it, rende, nomeProduto = "unidades", estoque, sugestoes, repetido, avisoRepetido = "esse ingrediente já está na receita", onMudar, onMover }: {
  it: IngredienteRascunho; rende: number; nomeProduto?: string; estoque?: number; sugestoes: IngredienteGuardado[];
  /** another line of the same recipe is this same ingredient */
  repetido?: boolean;
  /** why it is flagged (default: repeated in this recipe) */
  avisoRepetido?: string;
  onMudar: (m: Partial<IngredienteRascunho>) => void;
  /** 25/11: moves the line between "da receita" and "de cada unidade" (absent = flavours: per recipe only) */
  onMover?: (por: PorConsumo) => void;
}) {
  const [editando, setEditando] = useState(false);
  const medidas = useMedidaDeUsoDisponivel().data === true;
  const caixa = useRef<HTMLDivElement>(null);
  // 24/11: an ingredient already saved keeps its measure (its stock and cost are counted in it): only
  // the sizes of the same measure are offered (g ↔ kg, ml ↔ l). One bought "un" can still become g/ml.
  const opcoes = it.id && it.unidade !== "un" ? COMPRA.filter((c) => c.leva === it.unidade) : COMPRA;
  const compra = compraNaTela(it.unidade, it.pacote);
  const porUnidade = it.por === "unidade";
  const custoUso = it.qtd > 0 ? it.qtd * precoDe1(it) : 0;
  const custoLeva = it.qtd > 0 ? qtdNaLeva(it, rende) * precoDe1(it) : 0;
  const usar = (g: IngredienteGuardado) => {
    // same ingredient, one row in the database: shared by every recipe and by the market purchases
    onMudar({ id: g.id, nome: g.nome, unidade: g.unidade, pacote: g.pacote, ...(g.precoPacote > 0 && !(it.precoPacote > 0) ? { precoPacote: g.precoPacote } : {}),
      // 25/11: what its package holds is known: never asked again
      ...(g.embalagem !== undefined ? { embalagem: g.embalagem, conteudo: g.conteudo ?? null } : {}) });
    setEditando(false);
  };
  const aoSair = () => {
    setEditando(false);
    const igual = it.id ? undefined : ingredienteIgual(it.nome, sugestoes);
    if (igual) usar(igual);   // "leite  Condensado" → the "Leite condensado" he already has
  };
  return (
    <div ref={caixa} className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5" style={{ background: it.usa ? "#151515" : "#0b0b0c", border: `1px solid ${repetido ? "#FF6B6B" : it.confirmar ? "#F5B800" : it.usa ? "#26241f" : "#1a1917"}` }}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={it.usa ? "Tirar" : "Usar"} onClick={() => onMudar({ usa: !it.usa })}
          className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
          style={it.usa ? { background: "#F5B800", color: "#1A1200" } : { border: "1.5px solid #3a3833" }}>
          {it.usa && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
        </button>
        <input value={it.nome} placeholder="Nome do ingrediente" onChange={(e) => onMudar({ nome: e.target.value, id: undefined })}
          onFocus={() => setEditando(true)} onBlur={aoSair} enterKeyHint="next"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-extrabold" aria-label="Ingrediente" />
        {onMover && it.usa && !it.confirmar && (
          <button type="button" onClick={() => onMover(porUnidade ? "receita" : "unidade")}
            aria-label={porUnidade ? "Mover para ingredientes da receita" : "Mover para custos de cada unidade"}
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-extrabold" style={{ background: "#1a1a19", color: "#d8d2c4", border: "1px solid #2c2a25" }}>
            <ArrowDownUp className="w-3 h-3" /> {porUnidade ? "da receita" : "por unidade"}
          </button>
        )}
      </div>
      {editando && <Sugestoes texto={it.nome} lista={sugestoes} onEscolher={usar} />}
      {repetido && <span className="text-[11px] font-black pl-[30px]" style={{ color: "#FF6B6B" }}>{avisoRepetido}</span>}
      {it.usa && it.confirmar && onMover && <LinhaConfirmar it={it} nomeProduto={nomeProduto} onEscolher={onMover} />}
      {it.usa && (
        <>
          <div className={LINHA} style={{ color: "#b9b3a6" }}>
            <span className={PERGUNTA}>Quanto compro?</span>
            <MiniNumero key={`q-${compra.unidade}`} valor={compra.valor} rotulo="Quanto compra" largura={it.embalagem && it.unidade === "un" ? 40 : 64}
              onChange={(v) => {
                // an empty or zero field while typing keeps the last purchase
                if (!(v > 0)) return;
                onMudar({ pacote: pacoteDaCompra(v, compra.unidade, it.unidade), ...(it.precoPacote > 0 ? { precoEditado: true } : {}) });
              }} />
            <select value={it.unidade === "un" && it.embalagem ? it.embalagem : compra.unidade} aria-label="Unidade da compra"
              onChange={(e) => {
                const v = e.target.value;
                // 25/11: "caixinha", "lata"… are a "un" with a name: nothing about the stock changes
                if ((EMBALAGENS as readonly string[]).includes(v)) return onMudar({ unidade: "un", pacote: it.unidade === "un" ? Math.max(1, compra.valor) : 1, embalagem: v, ...(it.precoPacote > 0 && it.unidade !== "un" ? { precoEditado: true } : {}) });
                const c = COMPRA.find((x) => x.rotulo === v) ?? COMPRA[0]!;
                onMudar({ unidade: c.leva, pacote: Math.max(1, compra.valor) * c.fator, ...(medidas ? { embalagem: null } : {}), uso: undefined, ...(it.precoPacote > 0 ? { precoEditado: true } : {}) });
              }}
              className="h-9 rounded-[10px] bg-[#1a1a19] px-1.5 outline-none text-[13px] font-black text-[#F4F1EA] max-w-[96px]">
              {opcoes.map((u) => <option key={u.rotulo} value={u.rotulo}>{u.rotulo}</option>)}
              {medidas && (it.unidade === "un" || !it.id) && EMBALAGENS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className={LINHA} style={{ color: "#b9b3a6" }}>
            <span className={PERGUNTA}>Quanto pago?</span>
            <MiniDinheiro valor={it.precoPacote} onChange={(precoPacote) => onMudar({ precoPacote, precoEditado: true })} />
          </div>
          <QuantoUsa key={it.id ?? "novo"} it={it} porUnidade={porUnidade} medidas={medidas} onMudar={onMudar} />
          {custoLeva > 0 && (
            <span className="text-[12px] font-black pl-[30px]" style={{ color: "#F5B800" }}>
              {porUnidade ? `= ${reais(custoUso)} cada · ${rende >= 1 ? `${reais(custoLeva)} na receita (× ${fmt(rende)})` : "falta quanto a receita rende"}` : `= ${reais(custoLeva)} na receita`}
            </span>
          )}
          <LinhaMaisOpcoes it={it} rende={rende} nomeProduto={nomeProduto} onMudar={onMudar} />
          <span className="text-[10.5px] font-bold pl-[30px]" style={{ color: !it.aprender && !(it.qtd > 0) ? "#F5B800" : CINZA }}>
            {!it.aprender && !(it.qtd > 0) ? "pendente: falta quanto usa · " : ""}
            {estoque !== undefined ? `tem ${fmt(estoque)} ${it.unidade} guardado · ` : ""}pode ser aproximado
          </span>
        </>
      )}
    </div>
  );
}
