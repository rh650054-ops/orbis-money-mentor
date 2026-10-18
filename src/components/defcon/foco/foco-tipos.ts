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

export type CategoriaCusto = "mercadoria" | "transporte" | "alimentacao";

export const CATEGORIAS_CUSTO: { id: CategoriaCusto; label: string; col: "cost" | "transport_cost" | "food_cost"; placeholder: string }[] = [
  { id: "mercadoria", label: "Mercadoria", col: "cost", placeholder: "Quanto deu a mercadoria?" },
  { id: "transporte", label: "Transporte", col: "transport_cost", placeholder: "Quanto deu o transporte?" },
  { id: "alimentacao", label: "Almoço", col: "food_cost", placeholder: "Quanto deu o almoço?" },
];

export const brl0 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/** Toque com resposta: encolhe 3% por 100ms (padrão do prompt de redesign). */
export const PRESS = "active:scale-[.97] transition-transform duration-100 ease-out motion-reduce:transition-none";
