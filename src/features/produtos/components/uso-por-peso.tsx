/* VANT Receita Inteligente (24/11), the passion-fruit case: bought by weight, used by the piece or by
   the pulp. The seller tells what the purchase brought ("2 kg vieram 12 frutas", "deu 700 g de polpa")
   and the VANT divides the price by that. Nothing is estimated: without his number nothing changes.
   Only for a NEW ingredient: an ingredient already in stock keeps its unit (its stock is counted in it). */
import { useState } from "react";
import { precoDe1, type IngredienteRascunho } from "../lib/receitas";
import { fmt } from "../lib/formato";
import { reais } from "./campos";
import { MiniNumero } from "./mini-campos";

type Modo = "peso" | "unidade" | "rende";
const CHIP = (sel: boolean) => (sel ? { background: "#F5B800", color: "#1A1200" } : { background: "#1a1a19", color: "#d8d2c4", border: "1px solid #2c2a25" });

export function UsoPorPeso({ it, aberto, onAbrir, onMudar }: {
  it: IngredienteRascunho; aberto: boolean; onAbrir: () => void; onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [modo, setModo] = useState<Modo>("peso");
  // the weight bought, kept to describe the purchase and to go back to "pelo peso"
  const [peso, setPeso] = useState(it.unidade === "g" ? it.pacote : 0);
  const [n, setN] = useState(0);
  if (!aberto) {
    return (
      <button type="button" onClick={() => { setPeso(it.unidade === "g" ? it.pacote : peso); onAbrir(); }}
        className="self-start text-[11.5px] font-extrabold pl-[30px] py-1 underline underline-offset-2" style={{ color: "#F5B800" }}>
        compra por peso e usa por unidade ou pela polpa? ›
      </button>
    );
  }
  const pesoTxt = peso >= 1000 ? `${fmt(peso / 1000)} kg` : `${fmt(peso)} g`;
  const escolher = (m: Modo) => {
    setModo(m); setN(0);
    if (m === "peso" && peso > 0) onMudar({ unidade: "g", pacote: peso, qtd: 0 });
  };
  const aplicar = (v: number) => {
    setN(v);
    if (!(v > 0)) return;
    onMudar(modo === "unidade" ? { unidade: "un", pacote: Math.round(v), qtd: 0, aprender: false } : { unidade: "g", pacote: v, qtd: 0, aprender: false });
  };
  const cada = n > 0 && it.precoPacote > 0 ? precoDe1({ pacote: modo === "unidade" ? Math.round(n) : n, precoPacote: it.precoPacote }) : 0;
  return (
    <div className="flex flex-col gap-2 pl-[30px]">
      <span className="text-[11.5px] font-black" style={{ color: "#d8d2c4" }}>Como você mede o que usa?</span>
      <div className="flex flex-wrap gap-1.5">
        {([["peso", "Pelo peso da fruta"], ["unidade", "Por fruta / unidade"], ["rende", "Pela polpa que rende"]] as [Modo, string][]).map(([m, r]) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => escolher(m)} className="rounded-full px-3 py-2 text-[12px] font-extrabold min-h-[36px]" style={CHIP(modo === m)}>{r}</button>
        ))}
      </div>
      {modo !== "peso" && (peso > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
          <span>{modo === "unidade" ? `Nessa compra de ${pesoTxt} vieram` : `Essa compra de ${pesoTxt} deu`}</span>
          <MiniNumero valor={n} exemplo="?" rotulo={modo === "unidade" ? "Quantas unidades vieram" : "Quanto de polpa rendeu"} onChange={aplicar} />
          <span>{modo === "unidade" ? "frutas" : "g de polpa"}</span>
          {cada > 0 && <span className="font-black" style={{ color: "#F5B800" }}>= {reais(cada)} {modo === "unidade" ? "cada" : "o grama"}</span>}
        </div>
      ) : (
        <span className="text-[11.5px] font-bold" style={{ color: "#F5B800" }}>Primeiro diga quanto compra em kg ou g.</span>
      ))}
      {modo !== "peso" && !(n > 0) && <span className="text-[10.5px] font-bold" style={{ color: "#8A8A8A" }}>Não sabe? Deixe em branco e use "Ainda não sei": fica pendente.</span>}
    </div>
  );
}
