/* ============================================================
   JORNADA DO TESTE (Rick, 06/10/2026) — dia 0 (cadastro) + 3 dias de teste.
   Uma funcionalidade nova por dia; o Modo Foco e o ranking todo dia.
   Dias 0 e 1 vendem o VANT Essencial; dias 2 e 3 mostram o VANT Pro.
   Funções puras: testáveis e sem Supabase.
   ============================================================ */

export type Passo = "foco" | "ranking" | "relatorio" | "custo" | "sinal" | "marca" | "produto";
export type Oferta = "nenhuma" | "essencial" | "pro" | "planos";

export interface PassoJornada {
  id: Passo;
  nome: string;
  /** rota que cumpre o passo; "chat_marca" abre a IA pedindo a arte da marca */
  destino: string;
  botao: string;
}

export interface DiaJornada {
  dia: 0 | 1 | 2 | 3;
  titulo: string;
  texto: string;
  passos: PassoJornada[];
  /** o que aparece no fim do Foco desse dia (uma vez por dia) */
  oferta: Oferta;
  /** passos que o onboarding já cumpriu: aparecem marcados, só pra mostrar progresso */
  jaFeitos?: string[];
}

export const ABRIR_CHAT_MARCA = "chat_marca";
export const TEXTO_CHAT_MARCA = "Quero criar o adesivo premium da minha marca";

const FOCO: PassoJornada = { id: "foco", nome: "Fazer o Foco de hoje", destino: "/daily-goals", botao: "Começar o Foco" };

export const JORNADA: DiaJornada[] = [
  {
    // Dia 0 (Rick, 06/10): o onboarding já mostrou o DEFCON de treino e o ranking.
    // Aqui é pra valer: cadastrar o que ele vende (aparece na "mercadoria de hoje"
    // do Foco) e começar o primeiro dia de trabalho de verdade.
    dia: 0,
    titulo: "Seu primeiro dia de trabalho",
    texto: "Você já viu como o Foco e o ranking funcionam. Agora é pra valer: cadastre o que você vende e comece seu dia.",
    jaFeitos: ["Criar sua conta", "Definir sua meta mensal e diária"],
    passos: [
      { id: "produto", nome: "Cadastrar seu produto no estoque", destino: "/products", botao: "Cadastrar meu produto" },
      { ...FOCO, nome: "Começar seu primeiro dia de trabalho", botao: "Começar meu dia" },
    ],
    oferta: "nenhuma",
  },
  {
    dia: 1,
    titulo: "Quanto sobrou no seu bolso",
    texto: "Depois do Foco, abra o relatório: vendeu, gastou e o que sobrou de verdade.",
    passos: [FOCO, { id: "relatorio", nome: "Abrir o relatório do dia", destino: "/insights", botao: "Abrir o relatório" }],
    oferta: "essencial",
  },
  {
    dia: 2,
    titulo: "O lucro de cada produto",
    texto: "Fotografe a nota do atacado e a VANT calcula quanto custa cada unidade que você vende.",
    passos: [FOCO, { id: "custo", nome: "Calcular o custo pela nota", destino: "/custo-produto", botao: "Fotografar a nota" }],
    oferta: "pro",
  },
  {
    dia: 3,
    titulo: "Onde vender e a cara da sua marca",
    texto: "Último dia: veja os melhores pontos perto de você e crie a arte da sua marca com o seu Pix.",
    passos: [
      { id: "sinal", nome: "Ver os melhores pontos (Caça-Sinal)", destino: "/spot-finder", botao: "Abrir o Caça-Sinal" },
      { id: "marca", nome: "Criar a arte da sua marca", destino: ABRIR_CHAT_MARCA, botao: "Criar minha arte" },
      FOCO,
    ],
    oferta: "planos",
  },
];

/** Primeiro dia da jornada em que o passo aparece (foco vale todo dia). */
export function diaDoPasso(passo: Passo): number | null {
  const d = JORNADA.find((j) => j.passos.some((p) => p.id === passo));
  return d ? d.dia : null;
}

/** O passo pode ser marcado hoje? Fora do teste (dia null) sempre; no teste, só no dia dele ou depois. */
export function passoLiberado(passo: Passo, diaAtual: number | null): boolean {
  if (diaAtual == null) return true;
  const d = diaDoPasso(passo);
  return d == null || d <= diaAtual;
}

/** Dias entre duas datas "AAAA-MM-DD" (b - a), sem fuso no meio. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

/** Dia do teste hoje (0 = cadastro … 3 = último). null fora do teste. */
export function diaDoTeste(inicio: string | null | undefined, hojeBR: string): number | null {
  if (!inicio || !/^\d{4}-\d{2}-\d{2}/.test(inicio)) return null;
  const d = diasEntre(inicio.slice(0, 10), hojeBR);
  return d >= 0 && d <= 3 ? d : null;
}

export function jornadaDoDia(dia: number | null): DiaJornada | null {
  return dia == null ? null : JORNADA.find((j) => j.dia === dia) ?? null;
}

/** Texto do selo pequeno do topo ("Teste grátis · faltam 2 dias"). */
export function seloTeste(dia: number): string {
  const faltam = 3 - dia;
  if (faltam <= 0) return "Último dia do teste";
  return `Teste grátis · ${faltam === 1 ? "falta 1 dia" : `faltam ${faltam} dias`}`;
}

export const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
