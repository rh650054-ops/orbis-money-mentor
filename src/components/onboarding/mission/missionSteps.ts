import type { MissionEventType } from "@/shared/lib/missionEvents";

// As fases da "Missão de Boas-Vindas".
// Cada fase = um coachmark guiado sobre o app REAL.
//  - advanceOn "next": passo informativo, avança no toque do botão.
//  - advanceOn "action": passo travado — só avança quando a tela real
//    emite o evento (ex: venda registrada). O alvo fica clicável (interactive).
//  - special: renderiza um componente próprio no lugar do coachmark
//    (fase 1 = boas-vindas/assinatura; fase final = recompensa).
//
// Estrutura (6 fases): meta+horário foram fundidos numa fase só, porque o
// EditPlanningModal coleta meta mensal + horas/dia + dias/semana de uma vez.

export type MissionAdvance = "next" | "action";
export type MissionSpecial = "card-registration" | "reward";

export interface MissionStep {
  id: string;
  /** Rótulo de fase exibido no balão, ex: "Fase 2 de 6". */
  phase: number;
  /** Rota onde o passo acontece. O motor navega até ela antes de medir o alvo. */
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
  /** Permite pular este passo específico (passos opcionais, ex: DEFCON). */
  optional?: boolean;
  /** Renderiza um componente especial em vez do coachmark padrão. */
  special?: MissionSpecial;
}

export const TOTAL_PHASES = 6;

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
    id: "first-sale",
    phase: 4,
    route: "/transactions",
    selector: '[data-tour="registrar-venda"]',
    title: "Sua missão: a primeira venda",
    instruction:
      "Esse é o momento. Registra uma venda de verdade e vê o número subir no seu painel.",
    cta: "👉 preenche o valor e registra",
    advanceOn: "action",
    actionEvent: "sale-registered",
    interactive: true,
  },
  {
    id: "defcon",
    phase: 5,
    route: "/daily-goals",
    selector: '[data-tour="defcon-banner"]',
    title: "Sinta o DEFCON",
    instruction:
      "Modo de foco máximo: blocos de 60 min e meta do bloco. Ative quando for pra rua.",
    cta: "👉 toque pra sentir (ou pule)",
    advanceOn: "next",
    optional: true,
  },
  {
    id: "reward",
    phase: 6,
    route: "/",
    special: "reward",
    title: "Missão cumprida! 🏆",
    instruction: "Você desbloqueou sua primeira patente. Bora vender, parceiro!",
    advanceOn: "next",
  },
];
