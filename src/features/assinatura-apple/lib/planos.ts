/* What the plans screen shows, computed from StoreKit's own prices (never a fixed value). Pure. */
import { BANCO_APPLE_A_VENDA, PRODUTO, type OfertaApple, type ProdutoApple } from "../types";

export interface PlanoDaTela {
  id: string;
  titulo: string;
  linha: string;
  /** the amount CHARGED, as StoreKit formats it, with its period: the most prominent price */
  preco: string;
  periodo: "/mês" | "/ano";
  anual: boolean;
  /** only for the annual plan, and always below the charged amount */
  equivalente?: string;
  economia?: number;
}

const numero = (p: ProdutoApple | undefined): number | null => {
  const n = p ? Number(p.preco) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** How much the annual plan saves against twelve months of the monthly one, in whole percent. */
export function economiaDoAnual(anual: ProdutoApple | undefined, mensal: ProdutoApple | undefined): number | null {
  const a = numero(anual), m = numero(mensal);
  if (a === null || m === null) return null;
  const pct = Math.round((1 - a / (m * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** The annual price divided by twelve, in the product's own currency: information, never the price. */
export function equivalenteMensal(anual: ProdutoApple | undefined, locale = "pt-BR"): string | null {
  const a = numero(anual);
  if (a === null || !anual) return null;
  try {
    // rounded down to the cent, so "equivalent" never looks cheaper than it is
    return new Intl.NumberFormat(locale, { style: "currency", currency: anual.moeda }).format(Math.floor((a / 12) * 100) / 100);
  } catch { return null; }
}

const TEXTOS: Record<string, { titulo: string; linha: string }> = {
  [PRODUTO.essencial]: { titulo: "Essencial", linha: "Controle e gestão das suas vendas." },
  [PRODUTO.proMensal]: { titulo: "Pro mensal", linha: "Experiência completa da VANT." },
  [PRODUTO.proAnual]: { titulo: "Pro anual", linha: "Experiência completa, pagando uma vez por ano." },
};

/** The three main plans in the order of the screen. A product StoreKit did not return is left out. */
export function planosDaTela(produtos: ProdutoApple[]): PlanoDaTela[] {
  const por = new Map(produtos.map((p) => [p.id, p]));
  const saida: PlanoDaTela[] = [];
  for (const id of [PRODUTO.essencial, PRODUTO.proMensal, PRODUTO.proAnual]) {
    const p = por.get(id);
    if (!p) continue;
    const anual = p.periodo?.unidade === "ano";
    const plano: PlanoDaTela = { id, titulo: TEXTOS[id]?.titulo ?? p.nome, linha: TEXTOS[id]?.linha ?? p.descricao, preco: p.precoFormatado, periodo: anual ? "/ano" : "/mês", anual };
    if (anual) {
      plano.equivalente = equivalenteMensal(p) ?? undefined;
      plano.economia = economiaDoAnual(p, por.get(PRODUTO.proMensal)) ?? undefined;
    }
    saida.push(plano);
  }
  return saida;
}

/** May this product be bought now? The server's answer decides; the app never guesses. */
export function podeComprar(oferta: OfertaApple | null | undefined, produto: string): boolean {
  if (!oferta) return false;
  if (produto === PRODUTO.banco) return BANCO_APPLE_A_VENDA && oferta.banco === "livre";
  if (oferta.plano === "livre") return true;
  return oferta.plano === "trocar" && oferta.apple?.produto !== produto;
}

/** Why the main plan is not offered, in the customer's words. */
export function avisoDaOferta(oferta: OfertaApple): { titulo: string; texto: string } | null {
  switch (oferta.motivo) {
    case "hotmart_ativa": return { titulo: "Seu plano está ativo", texto: "Você já assina a VANT. É só continuar usando: nada a pagar por aqui." };
    case "hotmart_em_tolerancia": return { titulo: "Seu plano está ativo", texto: "Há um pagamento da sua assinatura em aberto. Regularize pelo mesmo meio em que você assinou." };
    case "hotmart_processando": return { titulo: "Sua assinatura está sendo processada", texto: "Já existe uma compra aguardando confirmação. Assim que o pagamento cair, o acesso libera sozinho." };
    case "hotmart_pagamento_pendente": return { titulo: "Você tem um pagamento pendente", texto: "Sua assinatura tem uma cobrança em aberto. Conclua esse pagamento em vez de assinar de novo." };
    case "cortesia": return { titulo: "Sua conta já tem acesso", texto: "Esta conta tem acesso liberado. Não há nada a contratar." };
    case "suspensa": return { titulo: "Conta suspensa", texto: "Fale com o suporte da VANT para regularizar sua conta." };
    default: return null;
  }
}

/* What the paywall promises. Only what the server really gives each plan: the plan book of
   25/10/2026 (migration 20261025200000_beneficios_por_plano): Essencial = Foco manual, Ranking,
   Relatório, Gestão manual, Comunidade (Mentor IA 10/dia, ai_limites); Pro = + Foco automático, Verificado, 1 banco, Mentor IA,
   Gestão automática, Caça-Sinal, Produtos, Diária definida, X1; Pro anual = + 2 bancos, Mentor completo.
   The bank add-on is not sold on the iPhone, so nothing here offers more banks than the plan has. */
export type IconeDestaque = "foco" | "relatorio" | "banco" | "mentor" | "sinal" | "ranking";
export interface Destaque { icone: IconeDestaque; titulo: string; texto: string; so_pro?: boolean }

export const DESTAQUES: Destaque[] = [
  { icone: "foco", titulo: "Foco por blocos de 1 hora", texto: "A meta do dia dividida em blocos, com cada venda e abordagem contadas." },
  { icone: "relatorio", titulo: "Relatório que mostra o lucro", texto: "Dia, semana e mês: vendas, custos, lucro e melhores horários." },
  { icone: "banco", titulo: "Banco conectado", texto: "O Pix que cai na conta entra sozinho nas suas vendas.", so_pro: true },
  { icone: "sinal", titulo: "Caça-Sinal e X1", texto: "Pontos de venda perto de você e desafios entre vendedores.", so_pro: true },
  { icone: "mentor", titulo: "Mentor IA", texto: "Dicas sobre o seu dia, com os seus números. Mais conversas no Pro." },
  { icone: "ranking", titulo: "Ranking e comunidade", texto: "Veja sua posição e aprenda com quem vende todo dia." },
];

const ESSENCIAL = ["Foco por blocos de 1 hora", "Relatório completo", "Ranking e comunidade", "Gestão financeira manual", "Mentor IA (uso básico)"];
const PRO = ["Tudo do Essencial", "1 banco conectado (Pix automático)", "Foco automático e meta adaptativa", "Caça-Sinal, Produtos e X1", "Selo Verificado", "Mentor IA ampliado"];

/** The list under the plans, for the plan chosen. */
export function incluiNoPlano(id: string): string[] {
  if (id === PRODUTO.essencial) return ESSENCIAL;
  if (id === PRODUTO.proAnual) return PRO.map((x) => (x.startsWith("1 banco") ? "2 bancos conectados (Pix automático)" : x === "Mentor IA ampliado" ? "Mentor IA completo" : x));
  return PRO;
}
