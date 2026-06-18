// Event bus da Missão de Boas-Vindas (onboarding gamificado).
// Telas reais emitem eventos quando o usuário faz a ação de verdade
// (salvar meta, cadastrar produto, registrar 1ª venda, iniciar DEFCON);
// o motor da missão (MissionTour) escuta e libera o passo travado por ação.

export type MissionEventType =
  | "goal-set" // meta mensal definida
  | "product-added" // mercadoria/estoque cadastrado
  | "schedule-set" // horário/dias de trabalho definidos
  | "sale-registered" // 1ª venda registrada (momento aha)
  | "defcon-started"; // DEFCON iniciado

const CHANNEL = "orbis:mission";

interface MissionEventDetail {
  type: MissionEventType;
  payload?: unknown;
}

/** Emitido pelas telas reais quando a ação acontece de fato. */
export function emitMissionEvent(type: MissionEventType, payload?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MissionEventDetail>(CHANNEL, { detail: { type, payload } }));
}

/** Assina os eventos da missão. Retorna função de cleanup. */
export function onMissionEvent(
  handler: (type: MissionEventType, payload?: unknown) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<MissionEventDetail>).detail;
    if (detail?.type) handler(detail.type, detail.payload);
  };
  window.addEventListener(CHANNEL, listener);
  return () => window.removeEventListener(CHANNEL, listener);
}
