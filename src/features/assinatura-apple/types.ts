/* Apple subscriptions on the iPhone (Etapa 3, 27/11/2026). Shared shapes of the feature. */

/** A product as StoreKit reports it for THIS customer's App Store. Prices are never fixed in the app. */
export interface ProdutoApple {
  id: string;
  nome: string;
  descricao: string;
  /** decimal as text ("419.9"), for arithmetic (the monthly equivalent, the saving) */
  preco: string;
  /** ready to show ("R$ 419,90"), formatted by StoreKit */
  precoFormatado: string;
  moeda: string;
  grupo?: string;
  periodo?: { unidade: "dia" | "semana" | "mes" | "ano" | "outro"; valor: number };
}

/** One transaction exactly as the native bridge hands it over. `jws` is what the server verifies. */
export interface TransacaoApple {
  jws: string;
  transacao: string;
  original: string;
  produto: string;
  /** the VANT account Apple signed into the purchase (appAccountToken), when there is one */
  conta?: string;
  expira?: number;
  revogada?: number;
  substituida?: boolean;
}

export type RespostaDaLoja =
  | ({ estado: "comprada" } & TransacaoApple)
  | { estado: "pendente"; produto: string }
  | { estado: "cancelada"; produto: string }
  | { estado: "desconhecido"; produto: string };

/** What public.assinatura_apple_oferta() answers: decided on the server, only drawn here. */
export interface OfertaApple {
  plano: "livre" | "trocar" | "bloqueado";
  motivo: "hotmart_ativa" | "hotmart_em_tolerancia" | "hotmart_processando" | "hotmart_pagamento_pendente" | "cortesia" | "suspensa" | "sem_sessao" | null;
  apple: { produto: string; renova: boolean | null; ate: string } | null;
  banco: "livre" | "ja_tem" | "sem_plano" | "bloqueado";
}

/** The end of one purchase attempt, as the screen needs to know it. */
export type ResultadoCompra =
  | { estado: "liberada"; produto: string }
  | { estado: "cancelada" }
  /** Ask to Buy / the bank still has to approve: nothing was charged yet */
  | { estado: "pendente_aprovacao"; produto: string }
  /** PAID, and the server could not confirm it now. Kept by StoreKit, retried without a new purchase. */
  | { estado: "aguardando_servidor"; produto: string; motivo: "sem_internet" | "servidor" | "sessao" }
  /** the purchase on this iPhone was made for another VANT account */
  | { estado: "de_outra_conta"; produto: string }
  | { estado: "recusada"; produto: string; motivo: string }
  /** the store failed BEFORE any payment */
  | { estado: "falhou"; motivo: "sem_internet" | "produto_indisponivel" | "compra_nao_permitida" | "falha_na_loja" | "sem_sessao" | "nao_ofertado" };

export const PRODUTO = {
  essencial: "app.vant.vendas.essencial.mensal",
  proMensal: "app.vant.vendas.pro.mensal",
  proAnual: "app.vant.vendas.pro.anual",
  banco: "app.vant.vendas.banco.mensal",
} as const;
/** Rick, 27/11/2026: the bank add-on is out of the first iPhone version (the server refuses it too). */
export const BANCO_APPLE_A_VENDA = false;
export const PLANOS_PRINCIPAIS: string[] = [PRODUTO.essencial, PRODUTO.proMensal, PRODUTO.proAnual];
