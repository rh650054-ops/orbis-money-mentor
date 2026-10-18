/* ============================================================
   FOCO (redesign 18/10/2026) — tipos e ajudantes compartilhados pelos blocos
   da tela. A tela é a "central de execução do dia": plano → ações rápidas →
   operação → manutenção. O DefconHub carrega os dados; cada bloco é puro.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";

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

/** Mesmo que brl0, mas respeita o "olho fechado" (Uber Privacy Mode / Nubank). */
export const brlOculto = (n: number, oculto: boolean) => (oculto ? "R$ •••" : brl0(n));

const CHAVE_OCULTAR = "vant_foco_ocultar";

/** Esconde os valores do card principal — preferência do aparelho, não da conta.
 *  O vendedor mostra o celular pra todo mundo no sinal. */
export function useOcultarValores(): [boolean, () => void] {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    try { setOculto(localStorage.getItem(CHAVE_OCULTAR) === "1"); } catch { /* sem storage: fica visível */ }
  }, []);
  const alternar = useCallback(() => {
    setOculto((v) => {
      try { localStorage.setItem(CHAVE_OCULTAR, v ? "0" : "1"); } catch { /* ignora */ }
      return !v;
    });
  }, []);
  return [oculto, alternar];
}

/** Toque com resposta: encolhe 3% por 100ms (padrão do prompt de redesign). */
export const PRESS = "active:scale-[.97] transition-transform duration-100 ease-out motion-reduce:transition-none";
