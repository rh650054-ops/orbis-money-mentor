/* Lógica da tela "Custo do produto pelas notas" (05/10/2026) — separada do componente
   pra poder testar e pra não misturar regra de conta com tela. */

export type Pagamento = "dinheiro" | "cartao" | "pix" | "dividido";

export interface ItemNota { descricao: string; qtd: number; unidade: string; valor: number; on: boolean }
export interface NotaLida {
  id: string;
  loja: string;
  data: string | null;
  total: number;
  itens: ItemNota[];
  pagamento: Pagamento;
  /** só no "dividido": quanto foi em dinheiro (o resto foi no cartão) */
  dinheiro: string;
}
export interface NotaApi {
  loja: string; data: string | null; total: number; soma_itens: number;
  pagamentos: { tipo: string; valor: number }[];
  itens: { descricao: string; qtd: number; unidade: string; valor: number }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
export const reaisParaNumero = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;

/** O que a nota trouxe de forma de pagamento vira a escolha inicial (ele corrige se quiser). */
export function pagamentoInicial(pags: NotaApi["pagamentos"]): { pagamento: Pagamento; dinheiro: string } {
  const din = pags.filter((p) => p.tipo === "dinheiro").reduce((s, p) => s + p.valor, 0);
  const outros = pags.filter((p) => p.tipo !== "dinheiro");
  if (din > 0 && outros.length) return { pagamento: "dividido", dinheiro: din.toFixed(2).replace(".", ",") };
  if (din > 0) return { pagamento: "dinheiro", dinheiro: "" };
  if (outros.some((p) => p.tipo === "pix")) return { pagamento: "pix", dinheiro: "" };
  return { pagamento: "cartao", dinheiro: "" };
}

export function notaDaApi(n: NotaApi, id: string): NotaLida {
  return {
    id, loja: n.loja, data: n.data, total: n.total,
    itens: n.itens.map((i) => ({ ...i, on: true })),
    ...pagamentoInicial(n.pagamentos),
  };
}

/** Quanto desta nota foi mercadoria: os itens marcados (nota digitada à mão = o total). */
export const valorMercadoria = (n: NotaLida) =>
  r2(n.itens.length ? n.itens.filter((i) => i.on).reduce((s, i) => s + i.valor, 0) : n.total);

/**
 * Partes que vão pro banco de dados: uma por forma de pagamento.
 * valor = o que entra no custo; valor_banco = o que apareceu no extrato (a nota
 * inteira no cartão, mesmo que parte dos itens fosse da casa) — é com ele que a
 * Vant acha a saída no banco e marca como Mercadoria.
 */
export function partesDaNota(n: NotaLida): { tipo: string; valor: number; valor_banco?: number }[] {
  const merc = valorMercadoria(n);
  if (merc <= 0) return [];
  if (n.pagamento !== "dividido") {
    return [{ tipo: n.pagamento, valor: merc, ...(n.pagamento !== "dinheiro" ? { valor_banco: r2(n.total) } : {}) }];
  }
  const din = Math.min(reaisParaNumero(n.dinheiro), merc);
  const cartaoMerc = r2(merc - din);
  const cartaoBanco = r2(Math.max(0, n.total - reaisParaNumero(n.dinheiro)));
  return [
    ...(din > 0 ? [{ tipo: "dinheiro", valor: r2(din) }] : []),
    ...(cartaoMerc > 0 ? [{ tipo: "cartao", valor: cartaoMerc, valor_banco: cartaoBanco }] : []),
  ];
}

export function resumoCusto(notas: NotaLida[], rendimento: number, precoVenda: number) {
  const total = r2(notas.reduce((s, n) => s + valorMercadoria(n), 0));
  const unidade = rendimento > 0 ? r2(total / rendimento) : 0;
  const sobra = precoVenda > 0 ? r2(precoVenda - unidade) : null;
  const margem = precoVenda > 0 ? Math.round(((precoVenda - unidade) / precoVenda) * 100) : null;
  return { total, unidade, sobra, margem };
}

/** Foto do celular (4000px, 5 MB) → JPEG de até 1600px: lê igual e sobe 10x mais rápido. */
export async function comprimirFoto(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("foto_invalida"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
