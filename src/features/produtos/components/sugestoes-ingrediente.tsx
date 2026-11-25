/* Saved ingredients matching what he types: the purchase and the stock land on the SAME ingredient
   (Rick 25/11, item 4: "leite integral por R$ 4,89/L" is offered again in another recipe, never duplicated). */
import type { IngredienteGuardado } from "../api/use-ingredientes-guardados-query";
import { nomeNormalizado } from "../lib/receitas";

const CINZA = "#8A8A8A";

export /** Saved ingredients matching what he types (the purchase lands on the same ingredient). */
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
