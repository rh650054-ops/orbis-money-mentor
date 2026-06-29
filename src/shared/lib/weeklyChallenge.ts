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
    grandPrizeDesc: "🏆 1º lugar da semana · pago no Pix dia 07/07",
    miniPrizes: [
      { valor: "01–05/07", label: "Período do desafio" },
      { valor: "Dom 23:59", label: "Encerra" },
    ],
    regrasTitulo: "🤝 Sistema de Afiliados",
    regras: [
      { nome: "Traga 3 pessoas pro Orbis", val: "R$ 50" },
    ],
    regrasNota: "Indique 3 amigos e ganhe R$50. · Vence quem fizer + faturamento — só cartão e pix contam.",
    acceptLabel: "PARTICIPAR DO DESAFIO AGORA →",
  },
];

// Bilhete dourado / desafio PAUSADO (estratégia adiada). Com isso, o bilhete não
// abre, o ícone some, o lembrete some e o fluxo não dispara. Pra REATIVAR: PAUSADO = false.
const PAUSADO = true;

// Desafio ativo hoje (fuso BR), ou null.
export function getActiveWeeklyChallenge(today?: string): WeeklyChallenge | null {
  if (PAUSADO) return null;
  const t = today ?? getBrazilDate();
  return DESAFIOS.find((d) => t >= d.inicio && t <= d.fim) ?? null;
}

// É o 1º dia do desafio? (o bilhete só abre sozinho no dia 1)
export function isFirstDay(c: WeeklyChallenge, today?: string): boolean {
  return (today ?? getBrazilDate()) === c.inicio;
}
