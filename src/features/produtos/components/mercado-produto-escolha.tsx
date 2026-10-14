/* "Tá comprando pra qual produto?" (Rick, 14/10): escolher o produto traz a
   receita dele pro carrinho. Produto sem receita = 1ª compra: a VANT aprende. */
import type { BaseMercado } from "../lib/mercado";
import { ingredientesDaReceita } from "../lib/mercado-produto";
import { Chip } from "./mercado-casca";

export function MercadoProdutoEscolha({ base, foco, primeiraVez, onEscolher }: {
  base: BaseMercado; foco: string | null; primeiraVez: boolean; onEscolher: (pid: string | null) => void;
}) {
  // o que ele FAZ (tem receita ou marcou "eu faço"); o que compra pronto vai nos atalhos
  const feitos = base.produtos.filter((p) => p.origem === "faz" || p.recipe_mode === "batch");
  if (feitos.length === 0) return null;
  const nome = base.produtos.find((p) => p.id === foco)?.name ?? "";
  const nIng = foco ? ingredientesDaReceita(foco, base).length : 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-extrabold" style={{ color: "#b9b3a6" }}>Tá comprando pra qual produto?</span>
      <div className="flex flex-wrap gap-2">
        {feitos.map((p) => (
          <Chip key={p.id} ativo={foco === p.id} onClick={() => onEscolher(foco === p.id ? null : p.id)}>
            {p.emoji ?? "📦"} {p.name}
          </Chip>
        ))}
        <Chip ativo={foco === null} onClick={() => onEscolher(null)}>Compra solta</Chip>
      </div>
      {foco && !primeiraVez && nIng > 0 && (
        <span className="text-[12px] font-bold" style={{ color: "#7b766e" }}>
          Já pus os {nIng} ingredientes da receita de {nome}. Só falta quantidade e preço de cada.
        </span>
      )}
      {primeiraVez && (
        <div className="rounded-[14px] px-3.5 py-3 text-[13px] font-bold leading-snug"
          style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.35)", color: "#e9dfc9" }}>
          Primeira compra pra {nome}. Anota o que você tá pegando e, no fim, me diz quantas dá pra fazer:
          eu guardo a receita e, da próxima vez, os ingredientes já aparecem aqui.
        </div>
      )}
    </div>
  );
}
