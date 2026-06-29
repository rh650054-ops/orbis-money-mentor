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
  miniPrizes: { valor: string; label: string }[];
  regrasTitulo: string;
  regras: { nome: string; val: string }[];
  regrasNota: string;
  acceptLabel: string;
}

const DESAFIOS: WeeklyChallenge[] = [
  {
    id: "2026-07-01",
    inicio: "2026-07-01",
    fim: "2026-07-05",
    introTag: "Você foi convidado",
    introTitulo: "DESAFIO DA SEMANA",
    introSub: "A primeira disputa de julho começou. Arrasta o cadeado pra ver o que tá valendo.",
    eventoLabel: "Liga Semanal · Orbis",
    ticketTitulo: "VALENDO R$100",
    grandPrizeValue: "R$ 100",
    grandPrizeDesc: "pro 1º lugar da semana (01 a 05/07)",
    miniPrizes: [],
    regrasTitulo: "Como funciona",
    regras: [
      { nome: "Quando", val: "01–05/07" },
      { nome: "Encerra", val: "Dom 23:59" },
      { nome: "Vence", val: "+ Faturamento" },
    ],
    regrasNota: "Suba teu extrato todo dia até as 9h pra venda contar. Dinheiro vivo não entra — só cartão e pix verificado.",
    acceptLabel: "TÔ NA DISPUTA →",
  },
];

// Desafio ativo hoje (fuso BR), ou null.
export function getActiveWeeklyChallenge(today?: string): WeeklyChallenge | null {
  const t = today ?? getBrazilDate();
  return DESAFIOS.find((d) => t >= d.inicio && t <= d.fim) ?? null;
}

// É o 1º dia do desafio? (o bilhete só abre sozinho no dia 1)
export function isFirstDay(c: WeeklyChallenge, today?: string): boolean {
  return (today ?? getBrazilDate()) === c.inicio;
}
