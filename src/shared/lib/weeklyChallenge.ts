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
    regrasTitulo: "💰 Sua comissão por assinatura",
    regras: [
      { nome: "Até 10 assinaturas", val: "R$ 5" },
      { nome: "11 a 30 assinaturas", val: "R$ 7" },
      { nome: "31+ assinaturas", val: "R$ 10" },
    ],
    regrasHighlight: "🔥 30 assinaturas = R$ 210 direto no seu Pix. Subiu de faixa, cada assinatura vale mais.",
    regrasNota: "Você ganha uma vez por cada assinatura que trouxer.",
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
