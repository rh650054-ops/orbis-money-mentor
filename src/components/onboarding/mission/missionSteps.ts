import type { MissionEventType } from "@/shared/lib/missionEvents";

// As fases da "Missão de Boas-Vindas".
// Cada fase = um coachmark guiado sobre o app REAL.
//  - advanceOn "next": passo informativo, avança no toque do botão.
//  - advanceOn "action": passo travado — só avança quando a tela real
//    emite o evento (ex: venda registrada). O alvo fica clicável (interactive).
//  - special: renderiza um componente próprio no lugar do coachmark
//    (fase 1 = boas-vindas/assinatura; fase final = recompensa).
//
// Estrutura (5 fases): boas-vindas -> metas -> produto -> 1ª venda NO DEFCON -> recompensa.
// A primeira venda (o "aha") acontece dentro do DEFCON (modo de guerra), que é a
// experiência de venda mais forte do app. O motor fica montado por cima de todas
// as rotas, então basta esperar o evento "sale-registered" — que o DEFCON dispara
// em qualquer venda (rápida ou manual). Passo opcional: dá pra pular sem travar.

export type MissionAdvance = "next" | "action";
export type MissionSpecial = "card-registration" | "reward";

export interface MissionStep {
  id: string;
  /** Rótulo de fase exibido no balão, ex: "Fase 2 de 5". */
  phase: number;
  /** Rota onde o passo começa. O motor navega até ela UMA vez ao entrar no passo. */
  route: string;
  /** Seletor CSS do alvo real (data-tour=...). Ausente = card central informativo. */
  selector?: string;
  title: string;
  instruction: string;
  /** Microcopy de comando, ex: "👉 toque em Vender". */
  cta?: string;
  advanceOn: MissionAdvance;
  /** Evento que libera o passo quando advanceOn === "action". */
  actionEvent?: MissionEventType;
  /** Se true, o "furo" do spotlight fica clicável pro usuário agir de verdade. */
  interactive?: boolean;
  /** Permite pular este passo específico (passos opcionais). */
  optional?: boolean;
  /** Renderiza um componente especial em vez do coachmark padrão. */
  special?: MissionSpecial;
}

export const TOTAL_PHASES = 5;

export const missionSteps: MissionStep[] = [
  {
    id: "welcome",
    phase: 1,
    route: "/",
    special: "card-registration",
    title: "Bem-vindo ao Orbis 🔥",
    instruction:
      "Vamos preparar seu corre em poucos passos. Primeiro: garante seu acesso.",
    advanceOn: "next",
  },
  {
    id: "goals",
    phase: 2,
    route: "/",
    selector: '[data-tour="meta-input"]',
    title: "Configure suas metas",
    instruction:
      "Diz quanto quer faturar no mês e quantas horas/dias trabalha. O Orbis calcula sua meta de cada dia.",
    cta: "👉 toque e preencha suas metas",
    advanceOn: "action",
    actionEvent: "goal-set",
    interactive: true,
  },
  {
    id: "product",
    phase: 3,
    route: "/products",
    selector: '[data-tour="add-product"]',
    title: "O que você vende?",
    instruction:
      "Cadastra um produto que você vende hoje e a quantidade no seu estoque.",
    cta: "👉 toque em Novo produto",
    advanceOn: "action",
    actionEvent: "product-added",
    interactive: true,
  },
  {
    id: "defcon-intro",
    phase: 4,
    route: "/daily-goals",
    selector: '[data-tour="defcon-banner"]',
    title: "Modo de guerra: DEFCON 4",
    instruction:
      "Quando for pra rua, entra no DEFCON 4: cronômetro, meta da hora, venda rápida e a IA te empurrando pra vender. É aqui que você foca e fatura.",
    cta: "👉 é só tocar aqui na hora de vender",
    advanceOn: "next",
  },
  {
    id: "reward",
    phase: 5,
    route: "/",
    special: "reward",
    title: "Missão cumprida! 🏆",
    instruction: "Você desbloqueou sua primeira patente. Bora vender, parceiro!",
    advanceOn: "next",
  },
];
