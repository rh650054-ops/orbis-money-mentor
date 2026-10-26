/* SOBRA DO ESTOQUE depois da compra (Rick, 26/10/2026 — vídeo).
   Pra cada produto da compra: o que ficou guardado de cada ingrediente da receita,
   quantas levas a mais cada um ainda dá e o que falta pra próxima leva.
   Ex.: comprou 57 leites condensados na promoção, fez 100 garrafinhas (5 levas) →
   sobrou 47, dá pra mais 23 levas; falta leite pra próxima. Puro. */

export interface ItemReceitaEstoque { nome: string; unidade: string; pacote: number; porLeva: number; estoque: number }
export interface SobraIngrediente { nome: string; texto: string; levas: number; falta: boolean }
export interface SobraProduto { sobras: SobraIngrediente[]; faltam: string[]; levasPossiveis: number }

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** "47 un de 395 g" quando tem embalagem; senão "1,2 kg", "800 ml", "12 un" */
export function textoEstoque(estoque: number, unidade: string, pacote: number): string {
  const u = (unidade || "un").toLowerCase();
  if (pacote > 1 && estoque > 0) return `${fmt(estoque / pacote)} un de ${fmt(pacote)} ${u}`;
  if (u === "g" && estoque >= 1000) return `${fmt(estoque / 1000)} kg`;
  if (u === "ml" && estoque >= 1000) return `${fmt(estoque / 1000)} L`;
  return `${fmt(estoque)} ${u}`;
}

export function sobraDoProduto(itens: ItemReceitaEstoque[]): SobraProduto {
  const usados = itens.filter((i) => i.porLeva > 0);
  const sobras = usados
    .map((i) => {
      const estoque = Math.max(0, i.estoque);
      const levas = Math.floor(estoque / i.porLeva + 1e-9);
      return { nome: i.nome, texto: textoEstoque(estoque, i.unidade, i.pacote), levas, falta: levas === 0 };
    })
    .sort((a, b) => Number(a.falta) - Number(b.falta) || b.levas - a.levas);
  return {
    sobras,
    faltam: sobras.filter((s) => s.falta).map((s) => s.nome),
    levasPossiveis: usados.length ? Math.min(...sobras.map((s) => s.levas)) : 0,
  };
}
