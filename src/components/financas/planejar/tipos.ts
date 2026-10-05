/* Tipos que a página de Finanças entrega pra aba Planejar (só apresentação). */

export interface PlanoQuitacao {
  dias: number;      // em quantos dias úteis quer quitar
  porDia: number;    // quanto guardar por dia útil
  quita: string;     // "08/10"
}

export interface ContaVM {
  id: string;
  nome: string;
  valor: number;
  guardado: number;
  falta: number;
  /** dias corridos até vencer (negativo = venceu há N dias); null = sem data */
  venceEm: number | null;
  vencida: boolean;
  pagaCiclo: boolean;     // recorrente já paga este mês
  coberta: boolean;       // guardado ≥ valor
  risco: "baixo" | "medio" | "alto";
  cartao: boolean;
  faturaAberta: boolean;
  porDia: number;         // parte dela no guardar de hoje
  diasUteis: number;      // dias de trabalho até vencer
  plano: PlanoQuitacao | null;
}

export interface DiaVM {
  key: string;
  label: string;          // "Hoje", "ter., 06/10"
  isToday: boolean;
  isWork: boolean;
  valor: number;
  feito: boolean;         // hoje já guardado
}

export interface ObjetivoVM {
  id: string;
  nome: string;
  foto: string | null;
  tem: number;
  alvo: number;
  pct: number;
  porDia: number;
  prazoTexto: string | null; // "cerca de 6 meses" / "chega ~12/11"
  concluido: boolean;
}

/** Resultado de uma ação que pode ser desfeita (toast com "Desfazer"). */
export type Desfazer = () => Promise<void>;
