/* Ficha: quanto cobra — preço de 1, combos ("2 por R$ 35") e preço na hora. */
import { Plus, X } from "lucide-react";
import type { Ficha } from "../lib/ficha";
import { CampoDinheiro, Contador } from "./campos";
import { Interruptor, Secao } from "./ficha-secao";

export function FichaPreco({ f, onMudar }: { f: Ficha; onMudar: (m: Partial<Ficha>) => void }) {
  const mudarCombo = (i: number, m: Partial<Ficha["combos"][number]>) =>
    onMudar({ combos: f.combos.map((c, j) => (j === i ? { ...c, ...m } : c)) });
  return (
    <Secao titulo="QUANTO VOCÊ COBRA" sub="No Foco, o valor da venda escolhe sozinho o produto e quantas saíram.">
      <Interruptor ligado={f.precoLivre} onMudar={(precoLivre) => onMudar({ precoLivre })}
        titulo="Preço na hora" sub="Valor combinado com o cliente a cada venda." />
      {!f.precoLivre && (
        <>
          <CampoDinheiro rotulo="Preço de 1 unidade" valor={f.preco} onChange={(preco) => onMudar({ preco })} />
          {f.combos.map((c, i) => (
            <div key={`${i}:${c.qty}`} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#121211", border: "1px solid #26241f" }}>
              <div className="flex items-center">
                <span className="flex-1 text-xs font-extrabold" style={{ color: "#b9b3a6" }}>Combo</span>
                <button type="button" aria-label="Tirar combo" className="p-1" style={{ color: "#7b766e" }}
                  onClick={() => onMudar({ combos: f.combos.filter((_, j) => j !== i) })}><X className="w-4 h-4" /></button>
              </div>
              <Contador rotulo="Quantas unidades" valor={c.qty} min={2} onChange={(qty) => mudarCombo(i, { qty })} />
              <CampoDinheiro rotulo={`Preço das ${c.qty}`} valor={c.price} onChange={(price) => mudarCombo(i, { price })} />
            </div>
          ))}
          <button type="button" onClick={() => onMudar({ combos: [...f.combos, { qty: (f.combos.at(-1)?.qty ?? 1) + 1, price: 0 }] })}
            className="rounded-2xl h-11 flex items-center justify-center gap-1.5 text-[13px] font-black"
            style={{ border: "1px dashed rgba(245,184,0,.5)", color: "#F5B800" }}>
            <Plus className="w-4 h-4" /> adicionar combo (2 un, 3 un…)
          </button>
        </>
      )}
    </Secao>
  );
}
