import { getBrazilDate } from "@/shared/lib/date-utils";

// Desafio da Liga Semanal (GRÁTIS). O bilhete dourado abre no 1º dia e fica um
// ícone dourado abaixo do DEFCON a semana toda. 1º desafio hardcoded; o painel
// admin pra criar os próximos vem depois.
export interface WeeklyChallenge {
  id: string;            // chave única (= início)
  inicio: string;        // "YYYY-MM-DD" (fuso BR)
  fim: string;           // "YYYY-MM-DD"
  introTag: string;
  introTitulo: string;
  introSub: string;
  eventoLabel: string;
  ticketTitulo: string;
  grandPrizeValue: string;
  grandPrizeDesc: string;
  grandPrizeBadge?: string;
  grandPrizeBadgeTone?: "sub" | "hot" | "red";
  miniPrizes: { valor: string; label: string; badge?: string; badgeTone?: "sub" | "hot" | "red" }[];
  regrasTitulo: string;
  regras: { nome: string; val: string }[];
  regrasNota: string;
  regrasHighlight?: string;
  commissionBadge?: string;
  commissionBadgeTone?: "sub" | "hot" | "red";
  whatsappLabel?: string;
  acceptLabel: string;
}

const DESAFIOS: WeeklyChallenge[] = [
  {
    id: "2026-07-01",
    inicio: "2026-07-01",
    fim: "2026-07-05",
    introTag: "Você foi convidado",
    introTitulo: "DESAFIO DA SEMANA",
    introSub: "Arraste e descubra quanto dá pra faturar já nesta semana — antes mesmo do ranking abrir.",
    eventoLabel: "Elite Orbis · Julho",
    ticketTitulo: "VOCÊ ESTÁ DENTRO",
    grandPrizeValue: "R$ 500",
    grandPrizeDesc: "Prêmio mensal",
    grandPrizeBadge: "COMEÇA 06/07",
    grandPrizeBadgeTone: "red",
    miniPrizes: [
      { valor: "R$ 100", label: "Top 1 da semana", badge: "COMEÇA 06/07", badgeTone: "red" },
      { valor: "R$ 50", label: "Por 3 assinaturas", badge: "LIBERADO HOJE", badgeTone: "hot" },
    ],
    regrasTitulo: "💰 Quanto você ganha",
    regras: [
      { nome: "10 assinaturas", val: "R$ 100" },
      { nome: "20 assinaturas", val: "R$ 170" },
      { nome: "30 assinaturas", val: "R$ 300" },
    ],
    regrasHighlight: "🔥 Bateu 30 assinaturas? São R$ 300 direto no seu Pix.",
    regrasNota: "Os valores são o total que você leva ao chegar em cada marca.",
    commissionBadge: "MISSÃO LIBERADA HOJE",
    commissionBadgeTone: "hot",
    whatsappLabel: "Pegar meu link de afiliado",
    acceptLabel: "ACEITAR O DESAFIO →",
  },
];

// Bilhete dourado / desafio PAUSADO (estratégia adiada). Com isso, o bilhete não
// abre, o ícone some, o lembrete some e o fluxo não dispara. Pra REATIVAR: PAUSADO = false.
const PAUSADO = false;

// Desafio ativo hoje (fuso BR), ou null.
export function getActiveWeeklyChallenge(today?: string): WeeklyChallenge | null {
  // Modo TESTE: abre o bilhete via URL (?bilhete-teste), ignorando data e pausa.
  // Não afeta usuário normal (só quem entra com o parâmetro).
  if (typeof window !== "undefined" && window.location.search.includes("bilhete-teste")) {
    return DESAFIOS[0] ?? null;
  }
  if (PAUSADO) return null;
  const t = today ?? getBrazilDate();
  return DESAFIOS.find((d) => t >= d.inicio && t <= d.fim) ?? null;
}

// É o 1º dia do desafio? (o bilhete só abre sozinho no dia 1)
export function isFirstDay(c: WeeklyChallenge, today?: string): boolean {
  return (today ?? getBrazilDate()) === c.inicio;
}

// O bilhete ainda precisa aparecer/terminar? (1º dia e ainda não visto).
// Usado no dashboard pra SEGURAR o modal de "meta do mês" até o bilhete acabar,
// evitando os dois overlays abrindo juntos (o que travava o app no dia 1).
export function isWeeklyTicketPending(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.search.includes("bilhete-teste")) return false;
  const c = getActiveWeeklyChallenge();
  if (!c) return false;
  return isFirstDay(c) && localStorage.getItem(`orbis_wc_seen2_${c.id}`) !== "1";
}

// Nome do evento disparado quando o bilhete termina (aceitar/fechar) → abre a meta.
export const WEEKLY_TICKET_DONE_EVENT = "orbis:weekly-ticket-done";
