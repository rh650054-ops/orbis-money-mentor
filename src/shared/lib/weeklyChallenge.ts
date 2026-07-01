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
  grandPrizeBadgeTone?: "sub" | "hot";
  miniPrizes: { valor: string; label: string; badge?: string; badgeTone?: "sub" | "hot" }[];
  regrasTitulo: string;
  regras: { nome: string; val: string }[];
  regrasNota: string;
  commissionBadge?: string;
  commissionBadgeTone?: "sub" | "hot";
  acceptLabel: string;
}

const DESAFIOS: WeeklyChallenge[] = [
  {
    id: "2026-07-01",
    inicio: "2026-07-01",
    fim: "2026-07-05",
    introTag: "Você foi convidado",
    introTitulo: "DESAFIO DA SEMANA",
    introSub: "Semana de alistamento. Arrasta o cadeado — e monta teu esquadrão antes do ranking abrir.",
    eventoLabel: "Elite Orbis · Julho",
    ticketTitulo: "VOCÊ ESTÁ DENTRO",
    grandPrizeValue: "R$ 500",
    grandPrizeDesc: "Prêmio máximo do desafio",
    grandPrizeBadge: "RANKING ABRE 06/07",
    grandPrizeBadgeTone: "sub",
    miniPrizes: [
      { valor: "R$ 100", label: "Top 1 da semana", badge: "RANKING · 06/07", badgeTone: "sub" },
      { valor: "R$ 50", label: "Por 3 indicações", badge: "LIBERADO HOJE", badgeTone: "hot" },
    ],
    regrasTitulo: "🤝 Comissão por indicação",
    regras: [
      { nome: "1º indicado", val: "R$ 5" },
      { nome: "2º indicado", val: "R$ 7" },
      { nome: "3º indicado", val: "R$ 10" },
    ],
    regrasNota: "O ranking de vendas abre segunda (06/07).",
    commissionBadge: "MISSÃO LIBERADA HOJE",
    commissionBadgeTone: "hot",
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
