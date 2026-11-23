import { VANT } from "./visual";
import type { RascunhoProduto } from "../types";

export type Situacao = { cor: string; titulo: string; texto: string; completar?: boolean };

const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;

/** What the answers mean for automatic production — said plainly, never hidden.
 *  23/11: a recipe is READY only when it has a yield and EVERY ingredient still checked has a quantity
 *  ("descubro depois" counts as missing). Unchecked ingredients are not in the recipe at all. Nothing
 *  is invented: a missing quantity is reported, never filled. */
export function situacaoDoCadastro(r: RascunhoProduto): Situacao {
  if (r.origem === "compra") return { cor: VANT.verde, titulo: "Revenda", texto: "Não precisa de receita. O estoque entra quando você registra a compra." };
  if (r.origem === null) return { cor: VANT.ouro, titulo: "Configurar depois", texto: "Já dá pra vender. Custo e produção automática ficam desligados até você completar." };
  const linhas = r.receita ?? [];   // only checked, named lines reach the draft (receitaDoRascunho)
  if (!linhas.length) return { cor: VANT.ouro, titulo: "Sem receita", texto: "Já dá pra vender. A produção automática só libera quando você cadastrar a receita.", completar: true };
  const faltam = linhas.filter((i) => i.aprender || !(i.qtd > 0)).length;
  const comQtd = linhas.length - faltam;
  if (r.rende >= 1 && faltam === 0) return { cor: VANT.verde, titulo: "Receita pronta", texto: `Rende ${r.rende}. Todos os ingredientes têm quantidade.` };
  if (comQtd === 0) return { cor: VANT.ouro, titulo: "Receita em rascunho", texto: "Fica salva, mas não libera produção automática até ter rendimento e quantidades.", completar: true };
  const falta = [r.rende >= 1 ? "" : "quanto rende", faltam ? `a quantidade de ${plural(faltam, "ingrediente")}` : ""].filter(Boolean).join(" e ");
  return {
    cor: VANT.ouro, titulo: "Receita parcialmente configurada", completar: true,
    texto: `Falta informar ${falta}. Seu produto será salvo, mas o controle automático da produção não fica completo: o que está sem quantidade não sai do estoque.`,
  };
}
