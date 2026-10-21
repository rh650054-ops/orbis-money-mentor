/* ============================================================
   FOCO (redesign 18/10/2026) — tipos e ajudantes compartilhados pelos blocos
   da tela. A tela é a "central de execução do dia": plano → ações rápidas →
   operação → manutenção. O DefconHub carrega os dados; cada bloco é puro.
   ============================================================ */
export type EstadoFoco = "antes" | "rodando" | "encerrado";

export interface ItemCarga { nome: string; levou: number; vendeu: number; preco: number; custo: number }

export interface DayTotals {
  cash: number; card: number; pix: number; debt: number; profit: number; cost: number; tips: number;
  transport: number; food: number;
}

// 19/10 (Rick): mercadoria saiu do Custo rápido. 21/10 (Mohamed, approved): it is back —
// a quick "Mercadoria" cost goes to personal_expenses (category Mercadoria), which both
// report paths (relatorio_bloco and relatorio_gastos_banco) count as mercadoria — daily_sales.cost
// is the cost-per-sale (CMV) and is replaced by bank data for Open Finance users, so it is
// not used here. "Tô no mercado" stays the full purchase flow (stock + recipe).
// "Outro" goes to personal_expenses (Outros).
export type CategoriaCusto = "mercadoria" | "transporte" | "alimentacao" | "outro";

export const CATEGORIAS_CUSTO: { id: CategoriaCusto; label: string; col: "transport_cost" | "food_cost" | null; placeholder: string }[] = [
  { id: "mercadoria", label: "Mercadoria", col: null, placeholder: "Valor da mercadoria" },
  { id: "transporte", label: "Transporte", col: "transport_cost", placeholder: "Valor do transporte" },
  { id: "alimentacao", label: "Almoço", col: "food_cost", placeholder: "Valor do almoço" },
  { id: "outro", label: "Outro", col: null, placeholder: "Quanto gastou?" },
];

export const brl0 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/** Compact BRL for tight boxes: below 10k as brl0, from 10k on "R$ 27,8k" (Mohamed 21/10). */
export const brlK = (n: number) => {
  if (Math.abs(n) < 10_000) return brl0(n);
  const k = Math.round(n / 100) / 10;
  return `R$ ${k.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
};

/** Toque com resposta: encolhe 3% por 100ms (padrão do prompt de redesign). */
export const PRESS = "active:scale-[.97] transition-transform duration-100 ease-out motion-reduce:transition-none";
