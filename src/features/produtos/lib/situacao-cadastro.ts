import { VANT } from "./visual";
import type { RascunhoProduto } from "../types";

type Situacao = { cor: string; titulo: string; texto: string };

/** What the answers mean for automatic production — said plainly, never hidden. */
export function situacaoDoCadastro(r: RascunhoProduto): Situacao {
  if (r.origem === "compra") return { cor: VANT.verde, titulo: "Revenda", texto: "Não precisa de receita. O estoque entra quando você registra a compra." };
  if (r.origem === null) return { cor: VANT.ouro, titulo: "Configurar depois", texto: "Já dá pra vender. Custo e produção automática ficam desligados até você completar." };
  const linhas = r.receita ?? [];
  const completa = r.rende >= 1 && linhas.some((i) => i.qtd > 0 && !i.aprender);
  const rascunhos = linhas.filter((i) => i.aprender || !(i.qtd > 0)).length;
  if (completa) return { cor: VANT.verde, titulo: "Receita pronta", texto: `Rende ${r.rende}. Pode usar a produção automática${rascunhos ? ` (${rascunhos} ingrediente${rascunhos > 1 ? "s" : ""} ainda sem quantidade)` : ""}.` };
  if (linhas.length) return { cor: VANT.ouro, titulo: "Receita em rascunho", texto: "Fica salva, mas não libera produção automática até ter rendimento e quantidades." };
  return { cor: VANT.ouro, titulo: "Sem receita", texto: "Já dá pra vender. A produção automática só libera quando você cadastrar a receita." };
}
