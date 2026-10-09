import { useState } from "react";
import { emojiDoNome } from "../lib/conta";
import { RASCUNHO_VAZIO, type ProdutoComFaixas, type RascunhoProduto } from "../types";

export type PassoQuiz = "nome" | "origem" | "custo" | "preco" | "estoque" | "pronto";
const ORDEM: PassoQuiz[] = ["nome", "origem", "custo", "preco", "estoque", "pronto"];
export const TOTAL_PASSOS = 5;

export function rascunhoDe(p: ProdutoComFaixas): RascunhoProduto {
  const combo = p.faixas.find((f) => f.qty >= 2) ?? null;
  return {
    id: p.id, nome: p.name, emoji: p.emoji || emojiDoNome(p.name), foto: p.photo_url,
    origem: p.origem, custo: p.cost, preco: p.sale_price, precoLivre: !!p.open_price,
    combo, estoque: p.stock_quantity, controlaEstoque: p.controla_estoque !== false,
  };
}

/** Estado do quiz: o rascunho do produto e em que pergunta ele está. */
export function useQuizProduto(inicial?: RascunhoProduto) {
  const [r, setR] = useState<RascunhoProduto>(inicial ?? RASCUNHO_VAZIO);
  const [passo, setPasso] = useState<PassoQuiz>("nome");
  /** unidades do pacote (passo do custo) pra sugerir "+1 pacote" no estoque */
  const [pacote, setPacote] = useState<number | null>(null);

  const mudar = (m: Partial<RascunhoProduto>) => setR((x) => ({ ...x, ...m }));
  const ir = (p: PassoQuiz) => { setPasso(p); window.scrollTo(0, 0); };
  const avancar = () => ir(ORDEM[Math.min(ORDEM.length - 1, ORDEM.indexOf(passo) + 1)]!);
  const voltar = (): boolean => {
    const i = ORDEM.indexOf(passo);
    if (i <= 0) return false;
    ir(ORDEM[i - 1]!);
    return true;
  };
  const recomecar = () => { setR(RASCUNHO_VAZIO); setPacote(null); ir("nome"); };

  return {
    r, passo, pacote, setPacote, ir, avancar, voltar, recomecar,
    setNome: (nome: string) => mudar({ nome, emoji: emojiDoNome(nome) }),
    setFoto: (foto: string | null) => mudar({ foto }),
    setOrigem: (origem: "compra" | "faz") => { mudar({ origem }); ir("custo"); },
    setCusto: (custo: number) => mudar({ custo }),
    setPreco: (preco: number) => mudar({ preco, precoLivre: false }),
    setPrecoLivre: () => { mudar({ precoLivre: true, preco: 0, combo: null }); ir("estoque"); },
    setCombo: (combo: RascunhoProduto["combo"]) => mudar({ combo }),
    setEstoque: (estoque: number) => mudar({ estoque, controlaEstoque: true }),
    semEstoque: () => mudar({ controlaEstoque: false, estoque: 0 }),
  };
}
