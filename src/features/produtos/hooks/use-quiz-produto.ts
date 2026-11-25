import { useEffect, useState } from "react";
import { emojiDoNome } from "../lib/conta";
import { apagarRascunho, guardarRascunho, lerRascunho } from "../lib/rascunho-cadastro";
import type { SaborRascunho } from "../lib/sabores";
import type { CustoExtra } from "../lib/receitas";
import { RASCUNHO_VAZIO, type ItemReceita, type ProdutoComFaixas, type RascunhoProduto } from "../types";

/* 22/11 (Etapa 2): 6 questions — what, how he gets it, recipe (makes) or cost (buys), flavours,
   price, review. "Configurar depois" skips question 3. The stock question lives in the review. */
export type PassoQuiz = "nome" | "origem" | "custo" | "sabores" | "preco" | "revisao" | "pronto";
const ORDEM: PassoQuiz[] = ["nome", "origem", "custo", "sabores", "preco", "revisao", "pronto"];
export const TOTAL_PASSOS = 6;

/** A new registration's product id, chosen once and kept in the draft (idempotent creation). */
function comId(r: RascunhoProduto, novo = false): RascunhoProduto {
  if (r.novoId && !novo) return r;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
  return { ...r, novoId: id };
}

export function rascunhoDe(p: ProdutoComFaixas): RascunhoProduto {
  const combo = p.faixas.find((f) => f.qty >= 2) ?? null;
  return {
    id: p.id, nome: p.name, emoji: p.emoji || emojiDoNome(p.name), foto: p.photo_url,
    origem: p.origem, custo: p.cost, preco: p.sale_price, precoLivre: !!p.open_price,
    combo, estoque: p.stock_quantity, controlaEstoque: p.controla_estoque !== false,
    receita: null, rende: p.batch_yield, sabores: [],
  };
}

/** Quiz state: the product draft and which question he is on. A NEW product's draft is kept per
 *  user until saved (lerRascunho), so leaving and coming back loses nothing. */
export function useQuizProduto(inicial?: RascunhoProduto, userId?: string) {
  const [retomado] = useState(() => (inicial ? null : lerRascunho(userId)));
  const [r, setR] = useState<RascunhoProduto>(() => inicial ?? comId(retomado?.r ?? RASCUNHO_VAZIO));
  const [passo, setPasso] = useState<PassoQuiz>(retomado?.passo ?? "nome");
  /** units of the pack (cost step) to suggest "+1 pacote" in the stock */
  const [pacote, setPacote] = useState<number | null>(null);

  useEffect(() => {
    if (inicial || passo === "pronto") return;
    guardarRascunho(userId, r, passo);
  }, [inicial, userId, r, passo]);

  const mudar = (m: Partial<RascunhoProduto>) => setR((x) => ({ ...x, ...m }));
  const ir = (p: PassoQuiz) => { setPasso(p); window.scrollTo(0, 0); };
  /** "Configurar depois" has no question 3 */
  const pula = (p: PassoQuiz) => p === "custo" && r.origem === null;
  const andar = (d: 1 | -1): PassoQuiz | null => {
    let i = ORDEM.indexOf(passo) + d;
    while (i >= 0 && i < ORDEM.length && pula(ORDEM[i]!)) i += d;
    return i >= 0 && i < ORDEM.length ? ORDEM[i]! : null;
  };
  const avancar = () => { const p = andar(1); if (p) ir(p); };
  const voltar = (): boolean => { const p = andar(-1); if (!p) return false; ir(p); return true; };
  const recomecar = () => { apagarRascunho(userId); setR(comId(RASCUNHO_VAZIO, true)); setPacote(null); ir("nome"); };

  return {
    r, passo, pacote, setPacote, ir, avancar, voltar, recomecar, retomado: !!retomado,
    terminou: () => apagarRascunho(userId),
    setNome: (nome: string) => mudar({ nome, emoji: emojiDoNome(nome) }),
    setFoto: (foto: string | null) => mudar({ foto }),
    setOrigem: (origem: "compra" | "faz" | null) => {
      // leaving "makes" drops the recipe typed here: a resale product has no recipe
      mudar({ origem, ...(origem !== "faz" ? { receita: null, rende: 0 } : {}) });
      ir(origem === null ? "sabores" : "custo");
    },
    setCusto: (custo: number) => mudar({ custo }),
    setPreco: (preco: number) => mudar({ preco, precoLivre: false }),
    setPrecoLivre: () => { mudar({ precoLivre: true, preco: 0, combo: null }); ir("revisao"); },
    setCombo: (combo: RascunhoProduto["combo"]) => mudar({ combo }),
    setReceita: (receita: ItemReceita[] | null, rende: number, extras: CustoExtra[] = []) => mudar({ receita, rende, extras }),
    setSabores: (sabores: SaborRascunho[]) => mudar({ sabores }),
    setEstoque: (estoque: number) => mudar({ estoque, controlaEstoque: true }),
    semEstoque: () => mudar({ controlaEstoque: false, estoque: 0 }),
  };
}
